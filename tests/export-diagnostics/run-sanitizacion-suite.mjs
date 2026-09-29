/**
 * PRUEBAS DE SEGURIDAD — EXPORTACIÓN DE REPORTES (CSV / EXCEL / PDF)
 * Reglas: security_and_rbac_rules.md §4.2 (inyección de fórmulas) y Barrera 4 de calidad.
 *
 * Ejecuta los constructores reales de activofijo-web (sin navegador, requiere tsx):
 *   pnpm run test:export
 */
import { construirCsv } from '../../../activofijo-web/src/lib/export/csvGenerator.ts';
import { construirFilasExcel } from '../../../activofijo-web/src/lib/export/excelGenerator.ts';
import { construirHtmlReporte } from '../../../activofijo-web/src/lib/export/pdfPrintGenerator.ts';
import { neutralizarFormula, escaparHtml } from '../../../activofijo-web/src/lib/export/sanitizar.ts';

const casos = [];
const AHORA = new Date('2026-09-28T12:00:00');

function registrar(id, descripcion, aprobado, detalle = '') {
  casos.push({ id, aprobado });
  console.log(`${aprobado ? '✅' : '❌'} ${id}: ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

const COLUMNAS = [
  { key: 'descripcion', label: 'Descripción', defaultVisible: true },
  { key: 'valor', label: 'Valor (Bs.)', defaultVisible: true, isNumeric: true, align: 'right' },
];

const PAYLOADS_FORMULA = ['=HYPERLINK("http://malicioso","clic")', '+1+1', '-2+3', '@SUM(A1:A9)', '\t=cmd|calc'];

const encabezado = (extra = {}) => ({ titulo: 'REPORTE', subtitulo: 'DEPARTAMENTO', gestion: 'Gestión 2026', incluirFirmas: true, ...extra });
const filtros = [{ label: 'Búsqueda', value: '' }];

// ── Utilidades ───────────────────────────────────────────────────────────────
registrar('EXP-01', 'neutralizarFormula prefija con apóstrofe = + - @ (y tabulación)',
  PAYLOADS_FORMULA.every((p) => neutralizarFormula(p) === `'${p}`));
registrar('EXP-02', 'neutralizarFormula no altera texto normal', neutralizarFormula('Servidor Dell R740') === 'Servidor Dell R740' && neutralizarFormula('') === '');
registrar('EXP-03', 'escaparHtml neutraliza < > & " \'', escaparHtml(`<a href="x">&'</a>`) === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');

// ── CSV ──────────────────────────────────────────────────────────────────────
const datos = PAYLOADS_FORMULA.map((descripcion, i) => ({ descripcion, valor: i - 2 }));
const csv = construirCsv(datos, COLUMNAS, encabezado(), filtros, AHORA);

registrar('EXP-04', 'CSV: toda celda que inicia con = + - @ sale prefijada con apóstrofe',
  PAYLOADS_FORMULA.every((p) => csv.includes(`"'${p.replace(/"/g, '""')}"`)));
registrar('EXP-05', 'CSV: ninguna celda de datos queda iniciando con un carácter de fórmula',
  !csv.split('\r\n').some((linea) => /^"[=+\-@\t]/.test(linea)));
registrar('EXP-06', 'CSV: los números (incluidos negativos) no se alteran', csv.includes('"-2"') && !csv.includes(`"'-2"`));

const csvEncabezado = construirCsv(
  [{ descripcion: 'x', valor: 1 }],
  COLUMNAS,
  encabezado({ titulo: '=cmd', subtitulo: '+cmd', gestion: '@cmd' }),
  [{ label: '-etiqueta', value: '=filtro' }],
  AHORA,
);
registrar('EXP-07', 'CSV: título, subtítulo, gestión y criterios de filtro también se neutralizan',
  csvEncabezado.includes(`"'=cmd"`) && csvEncabezado.includes(`"'+cmd - @cmd"`) && csvEncabezado.includes(`"'-etiqueta:"`) && csvEncabezado.includes(`"'=filtro"`));

registrar('EXP-08', 'CSV: comillas internas escapadas y BOM UTF-8 presente',
  construirCsv([{ descripcion: 'dice "hola"', valor: 1 }], COLUMNAS, encabezado(), [], AHORA).includes('"dice ""hola"""') && csv.startsWith('﻿'));

// ── Excel ────────────────────────────────────────────────────────────────────
const { filas } = construirFilasExcel(datos, COLUMNAS, encabezado({ subtitulo: '=cmd' }), [{ label: 'Búsqueda', value: '=x' }], AHORA);
const celdasTexto = filas.flat().filter((c) => typeof c === 'string');

registrar('EXP-09', 'Excel: ninguna celda de texto inicia con carácter de fórmula', !celdasTexto.some((c) => /^[=+\-@\t\r]/.test(c)));
registrar('EXP-10', 'Excel: los textos peligrosos quedan prefijados', PAYLOADS_FORMULA.every((p) => celdasTexto.includes(`'${p}`)));
registrar('EXP-11', 'Excel: subtítulo con = se neutraliza en el membrete', celdasTexto.includes("'=CMD"));
registrar('EXP-12', 'Excel: las cantidades siguen siendo numéricas (no se convierten en texto)',
  filas.flat().includes(-2) && filas.flat().includes(-1) && filas.flat().includes(0));

// ── PDF (HTML de impresión) ──────────────────────────────────────────────────
const XSS = '<script>alert(1)</script>';
const html = construirHtmlReporte(
  [{ descripcion: XSS, valor: 5 }],
  [{ ...COLUMNAS[0], label: '<b>Col</b>' }, COLUMNAS[1]],
  encabezado({ titulo: '"><img src=x onerror=alert(1)>', subtitulo: '<i>sub</i>', gestion: '<u>2026</u>' }),
  { tamano: 'a4', orientacion: 'landscape', numerarFilas: true },
  [{ label: '<x>', value: '"><svg onload=alert(2)>' }],
  '<b>Operador</b>',
  AHORA,
);

registrar('EXP-13', 'PDF: el HTML inyectado en una celda se escapa', html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !html.includes(XSS));
registrar('EXP-14', 'PDF: título, subtítulo, gestión y operador se escapan',
  !html.includes('<img src=x') && !html.includes('<i>sub</i>') && !html.includes('<u>2026</u>') && !html.includes('<b>Operador</b>') && html.includes('&lt;img src=x onerror=alert(1)&gt;'));
registrar('EXP-15', 'PDF: etiquetas de columna y criterios de filtro se escapan', !html.includes('<b>Col</b>') && !html.includes('<svg onload') && !html.includes('<x>'));
registrar('EXP-16', 'PDF: el único <script> es el propio de la plantilla (no se rompió el documento)', (html.match(/<script/g) ?? []).length === 1);
registrar('EXP-17', 'PDF: numeración N° activa solo por configuración', html.includes('>N°</th>') &&
  !construirHtmlReporte([{ descripcion: 'a', valor: 1 }], COLUMNAS, encabezado(), { tamano: 'a4', orientacion: 'landscape' }, [], undefined, AHORA).includes('>N°</th>'));

const aprobados = casos.filter((c) => c.aprobado).length;
console.log(`\nResultado: ${aprobados}/${casos.length} casos aprobados`);
process.exit(aprobados === casos.length ? 0 : 1);
