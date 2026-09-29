/**
 * PRUEBAS DE CAJA NEGRA — VERIFICACIÓN EN DOS PASOS (TOTP) EN EL INICIO DE SESIÓN
 * Plan: docs/plans/plan-identidad-autenticacion-totp.md
 *
 * Uso (con el core levantado y TRUST_PROXY=loopback):
 *   API_URL=http://localhost:3000 node tests/2fa-diagnostics/run-2fa-suite.mjs
 *
 * Crea usuarios temporales `test.2fa.*` y, al terminar, los desactiva (no se borran: la bitácora es append-only).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import pg from 'pg';
import { generate } from 'otplib';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const PASSWORD = 'Test2fa#Clave2026';
const RUN_ID = Date.now();
const DIR = path.dirname(fileURLToPath(import.meta.url));

const resultados = { timestamp: new Date().toISOString(), baseUrl: BASE_URL, casos: [], latencias: [] };
let contadorIp = 0;

const db = new pg.Client({
  connectionString: process.env.DIRECT_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function registrar(id, descripcion, aprobado, detalle = '') {
  resultados.casos.push({ id, descripcion, aprobado, detalle });
  console.log(`${aprobado ? '✅' : '❌'} ${id}: ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

// Cada grupo usa una IP distinta (X-Forwarded-For) para no chocar con el límite de 10 solicitudes por minuto.
function nuevaIp() {
  contadorIp += 1;
  return `10.20.${RUN_ID % 200}.${contadorIp}`;
}

async function http(metodo, ruta, { cuerpo, token, ip = nuevaIp(), etiquetaLatencia } = {}) {
  const inicio = performance.now();
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': ip,
      'User-Agent': 'suite-2fa/1.0',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const ms = Math.round(performance.now() - inicio);
  if (etiquetaLatencia) resultados.latencias.push({ operacion: etiquetaLatencia, ms });
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = { texto };
  }
  return { estado: respuesta.status, datos, ms, cabeceras: respuesta.headers, ip };
}

async function crearUsuario(rol) {
  const email = `test.2fa.${RUN_ID}.${rol.toLowerCase()}.${Math.random().toString(36).slice(2, 6)}@uagrm.edu.bo`;
  const hash = await argon2.hash(PASSWORD);
  const { rows } = await db.query(
    `INSERT INTO core.auth_usuario (email, password_hash, nombre_completo) VALUES ($1, $2, $3) RETURNING id`,
    [email, hash, `Prueba 2FA ${rol}`],
  );
  await db.query(`INSERT INTO core.auth_usuario_rol (usuario_id, rol_id) VALUES ($1, $2)`, [rows[0].id, rol]);
  return { id: rows[0].id, email, rol };
}

async function iniciarSesion(usuario, ip) {
  return http('POST', '/auth/login', { cuerpo: { identificador: usuario.email, password: PASSWORD, deviceId: 'suite-2fa' }, ip, etiquetaLatencia: 'login' });
}

// Deja al usuario con 2FA activo por la vía pública del desafío. Devuelve secreto, códigos de respaldo y sesión.
async function activarPorDesafio(usuario) {
  const ip = nuevaIp();
  const login = await iniciarSesion(usuario, ip);
  const { desafioToken } = login.datos;
  const configuracion = await http('POST', '/auth/2fa/inicial/configurar', { cuerpo: { desafioToken }, ip });
  const secreto = configuracion.datos.secreto;
  const activacion = await http('POST', '/auth/2fa/inicial/activar', {
    cuerpo: { desafioToken, codigo: await generate({ secret: secreto }) },
    ip,
    etiquetaLatencia: 'activar-2fa',
  });
  return { secreto, codigosRespaldo: activacion.datos.codigosRespaldo, sesion: activacion.datos.sesion };
}

const codigoFuturo = (secreto) => generate({ secret: secreto, epoch: Math.floor(Date.now() / 1000) + 30 });

async function ejecutar() {
  await db.connect();
  const creados = [];
  const nuevo = async (rol) => {
    const u = await crearUsuario(rol);
    creados.push(u);
    return u;
  };

  try {
    // ── CP-2FA-01..03: login sin 2FA y obligatoriedad por rol ─────────────────────────
    const funcionario = await nuevo('FUNCIONARIO');
    const r1 = await iniciarSesion(funcionario);
    registrar('CP-2FA-01', 'FUNCIONARIO sin 2FA entra directamente (contrato de login intacto)',
      r1.estado === 201 && !!r1.datos?.accessToken && !!r1.datos?.refreshToken && !r1.datos?.requiere2fa, `HTTP ${r1.estado}, ${r1.ms} ms`);

    const jefe = await nuevo('JEFE_ACTIVO_FIJO');
    const ipJefe = nuevaIp();
    const r2 = await iniciarSesion(jefe, ipJefe);
    registrar('CP-2FA-02', 'JEFE_ACTIVO_FIJO sin 2FA recibe desafío de configuración y ninguna sesión',
      r2.estado === 201 && r2.datos?.requiereConfiguracion2fa === true && !!r2.datos?.desafioToken && !r2.datos?.accessToken, `HTTP ${r2.estado}`);

    const r3 = await http('GET', '/auth/me', { token: r2.datos?.desafioToken });
    registrar('CP-2FA-03', 'El desafío no sirve como token de acceso a la API', r3.estado === 401, `HTTP ${r3.estado}`);

    // ── CP-2FA-04..07: configuración inicial y activación ────────────────────────────
    const cfg = await http('POST', '/auth/2fa/inicial/configurar', { cuerpo: { desafioToken: r2.datos.desafioToken }, ip: ipJefe });
    registrar('CP-2FA-04', 'Configuración inicial devuelve secreto y URI otpauth sin caché',
      cfg.estado === 201 && cfg.datos?.otpauthUri?.startsWith('otpauth://totp/') && /no-store/.test(cfg.cabeceras.get('cache-control') || ''),
      `HTTP ${cfg.estado}`);
    const secretoJefe = cfg.datos.secreto;

    const malo = await http('POST', '/auth/2fa/inicial/activar', { cuerpo: { desafioToken: r2.datos.desafioToken, codigo: '000000' }, ip: ipJefe });
    registrar('CP-2FA-05', 'Activar con código incorrecto responde 401', malo.estado === 401, `HTTP ${malo.estado}`);

    const formato = await http('POST', '/auth/2fa/inicial/activar', { cuerpo: { desafioToken: r2.datos.desafioToken, codigo: 'abc' }, ip: ipJefe });
    registrar('CP-2FA-06', 'Activar con formato inválido responde 400', formato.estado === 400, `HTTP ${formato.estado}`);

    const activado = await http('POST', '/auth/2fa/inicial/activar', {
      cuerpo: { desafioToken: r2.datos.desafioToken, codigo: await generate({ secret: secretoJefe }) },
      ip: ipJefe,
      etiquetaLatencia: 'activar-2fa',
    });
    const codigosJefe = activado.datos?.codigosRespaldo ?? [];
    registrar('CP-2FA-07', 'Activar con código válido emite sesión y 10 códigos de respaldo',
      activado.estado === 201 && !!activado.datos?.sesion?.accessToken && codigosJefe.length === 10, `HTTP ${activado.estado}, ${activado.ms} ms`);

    const perfil = await http('GET', '/auth/me', { token: activado.datos?.sesion?.accessToken, etiquetaLatencia: 'perfil' });
    registrar('CP-2FA-08', 'El perfil refleja 2FA activo y obligatorio',
      perfil.estado === 200 && perfil.datos?.dosFactoresActivo === true && perfil.datos?.dosFactoresObligatorio === true, `HTTP ${perfil.estado}`);

    // ── CP-2FA-09..14: segundo paso del login ───────────────────────────────────────
    const ipLogin = nuevaIp();
    const l2 = await iniciarSesion(jefe, ipLogin);
    registrar('CP-2FA-09', 'Con 2FA activo el login pide el segundo paso', l2.estado === 201 && l2.datos?.requiere2fa === true && !l2.datos?.accessToken, `HTTP ${l2.estado}`);

    const incorrecto = await http('POST', '/auth/2fa/verificar', { cuerpo: { desafioToken: l2.datos.desafioToken, codigo: '000000' }, ip: ipLogin });
    registrar('CP-2FA-10', 'Código incorrecto responde 401 con mensaje genérico', incorrecto.estado === 401 && /inválido o vencido/.test(incorrecto.datos?.message || ''), `HTTP ${incorrecto.estado}`);

    const codigoValido = await codigoFuturo(secretoJefe);
    const ok = await http('POST', '/auth/2fa/verificar', { cuerpo: { desafioToken: l2.datos.desafioToken, codigo: codigoValido }, ip: ipLogin, etiquetaLatencia: 'verificar-2fa' });
    registrar('CP-2FA-11', 'Código TOTP válido emite la sesión', ok.estado === 201 && !!ok.datos?.accessToken && !!ok.datos?.refreshToken, `HTTP ${ok.estado}, ${ok.ms} ms`);

    const ipRepetido = nuevaIp();
    const l3 = await iniciarSesion(jefe, ipRepetido);
    const repetido = await http('POST', '/auth/2fa/verificar', { cuerpo: { desafioToken: l3.datos.desafioToken, codigo: codigoValido }, ip: ipRepetido });
    registrar('CP-2FA-12', 'Un código ya usado no se puede reutilizar', repetido.estado === 401, `HTTP ${repetido.estado}`);

    const inyeccion = await http('POST', '/auth/2fa/verificar', { cuerpo: { desafioToken: l3.datos.desafioToken, codigo: "' OR '1'='1" }, ip: ipRepetido });
    registrar('CP-2FA-13', "Payload SQL (' OR '1'='1) neutralizado sin error 500", [400, 401].includes(inyeccion.estado), `HTTP ${inyeccion.estado}`);

    const sinDesafio = await http('POST', '/auth/2fa/verificar', { cuerpo: { codigo: '123456' }, ip: nuevaIp() });
    registrar('CP-2FA-14', 'Verificar sin desafío responde 400', sinDesafio.estado === 400, `HTTP ${sinDesafio.estado}`);

    // ── CP-2FA-15..16: códigos de respaldo ───────────────────────────────────────────
    const ipRespaldo = nuevaIp();
    const l4 = await iniciarSesion(jefe, ipRespaldo);
    const conRespaldo = await http('POST', '/auth/2fa/verificar', { cuerpo: { desafioToken: l4.datos.desafioToken, codigo: codigosJefe[0] }, ip: ipRespaldo });
    registrar('CP-2FA-15', 'Un código de respaldo válido permite entrar', conRespaldo.estado === 201 && !!conRespaldo.datos?.accessToken, `HTTP ${conRespaldo.estado}`);

    const l5 = await iniciarSesion(jefe, ipRespaldo);
    const respaldoRepetido = await http('POST', '/auth/2fa/verificar', { cuerpo: { desafioToken: l5.datos.desafioToken, codigo: codigosJefe[0] }, ip: ipRespaldo });
    registrar('CP-2FA-16', 'Un código de respaldo sirve una sola vez', respaldoRepetido.estado === 401, `HTTP ${respaldoRepetido.estado}`);

    // ── CP-2FA-17..19: usuario con 2FA opcional ──────────────────────────────────────
    const opcional = await nuevo('FUNCIONARIO');
    const sesionOpcional = (await iniciarSesion(opcional)).datos;
    const cfgOpc = await http('POST', '/auth/2fa/configurar', { token: sesionOpcional.accessToken });
    const actOpc = await http('POST', '/auth/2fa/activar', { token: sesionOpcional.accessToken, cuerpo: { codigo: await generate({ secret: cfgOpc.datos?.secreto }) } });
    registrar('CP-2FA-17', 'FUNCIONARIO activa voluntariamente su 2FA con sesión abierta',
      cfgOpc.estado === 201 && actOpc.estado === 201 && actOpc.datos?.codigosRespaldo?.length === 10, `HTTP ${cfgOpc.estado}/${actOpc.estado}`);

    const desactivarMal = await http('POST', '/auth/2fa/desactivar', { token: sesionOpcional.accessToken, cuerpo: { password: 'incorrecta', codigo: await codigoFuturo(cfgOpc.datos.secreto) } });
    registrar('CP-2FA-18', 'Desactivar con contraseña incorrecta responde 401', desactivarMal.estado === 401, `HTTP ${desactivarMal.estado}`);

    const desactivar = await http('POST', '/auth/2fa/desactivar', { token: sesionOpcional.accessToken, cuerpo: { password: PASSWORD, codigo: await codigoFuturo(cfgOpc.datos.secreto) } });
    registrar('CP-2FA-19', 'Desactivar con contraseña y código válidos', [200, 201].includes(desactivar.estado), `HTTP ${desactivar.estado}`);

    const jefeDesactiva = await http('POST', '/auth/2fa/desactivar', { token: ok.datos.accessToken, cuerpo: { password: PASSWORD, codigo: await codigoFuturo(secretoJefe) } });
    registrar('CP-2FA-20', 'Un rol obligatorio no puede desactivar el 2FA (403)', jefeDesactiva.estado === 403, `HTTP ${jefeDesactiva.estado}`);

    // ── CP-2FA-21..25: reinicio por el administrador (RBAC) ──────────────────────────
    const funcSesion = (await iniciarSesion(await nuevo('FUNCIONARIO'))).datos;
    const sinPermiso = await http('POST', `/usuarios/${jefe.id}/reiniciar-2fa`, { token: funcSesion.accessToken });
    registrar('CP-2FA-21', 'FUNCIONARIO no puede reiniciar el 2FA de otro (403)', sinPermiso.estado === 403, `HTTP ${sinPermiso.estado}`);

    const admin = await nuevo('ADMINISTRADOR');
    const { sesion: sesionAdmin } = await activarPorDesafio(admin);

    const idInvalido = await http('POST', '/usuarios/no-es-uuid/reiniciar-2fa', { token: sesionAdmin.accessToken });
    registrar('CP-2FA-22', 'Identificador inválido responde 400', idInvalido.estado === 400, `HTTP ${idInvalido.estado}`);

    const inexistente = await http('POST', '/usuarios/00000000-0000-4000-8000-000000000000/reiniciar-2fa', { token: sesionAdmin.accessToken });
    registrar('CP-2FA-23', 'Usuario inexistente responde 404', inexistente.estado === 404, `HTTP ${inexistente.estado}`);

    const reinicio = await http('POST', `/usuarios/${jefe.id}/reiniciar-2fa`, { token: sesionAdmin.accessToken });
    registrar('CP-2FA-24', 'ADMINISTRADOR reinicia el 2FA de un usuario', [200, 201].includes(reinicio.estado), `HTTP ${reinicio.estado}`);

    const trasReinicio = await iniciarSesion(jefe);
    registrar('CP-2FA-25', 'Tras el reinicio el rol obligatorio debe volver a configurar su 2FA', trasReinicio.datos?.requiereConfiguracion2fa === true, `HTTP ${trasReinicio.estado}`);

    // ── CP-2FA-26: bloqueo por intentos ──────────────────────────────────────────────
    const bloqueable = await nuevo('JEFE_ACTIVO_FIJO');
    await activarPorDesafio(bloqueable);
    const ipBloqueo = nuevaIp();
    const lb = await iniciarSesion(bloqueable, ipBloqueo);
    let ultimo;
    for (let i = 0; i < 5; i++) {
      ultimo = await http('POST', '/auth/2fa/verificar', { cuerpo: { desafioToken: lb.datos.desafioToken, codigo: '000000' }, ip: ipBloqueo });
    }
    const trasBloqueo = await iniciarSesion(bloqueable, nuevaIp());
    registrar('CP-2FA-26', 'Cinco códigos incorrectos bloquean la cuenta',
      /bloqueado/i.test(ultimo?.datos?.message || '') && trasBloqueo.estado === 401 && /bloqueado/i.test(trasBloqueo.datos?.message || ''), `HTTP ${ultimo?.estado}/${trasBloqueo.estado}`);

    // ── CP-2FA-27: límite de solicitudes ─────────────────────────────────────────────
    const ipLimite = nuevaIp();
    const estados = [];
    for (let i = 0; i < 14; i++) {
      estados.push((await http('POST', '/auth/2fa/verificar', { cuerpo: { desafioToken: 'x', codigo: '123456' }, ip: ipLimite })).estado);
    }
    registrar('CP-2FA-27', 'Más de 10 intentos por minuto desde una IP reciben 429', estados.includes(429), `estados: ${[...new Set(estados)].join(',')}`);

    // ── CP-2FA-28: bitácora forense ──────────────────────────────────────────────────
    const { rows: acciones } = await db.query(
      `SELECT accion, resultado, ip_origen, user_agent FROM core.auth_auditoria_forense
       WHERE email_usuario = ANY($1) AND accion = ANY($2)`,
      [creados.map((u) => u.email), ['ACTIVAR_2FA', 'LOGIN_2FA_EXITOSO', 'LOGIN_2FA_FALLIDO', 'ACTIVAR_2FA_FALLIDO', 'DESACTIVAR_2FA', 'DESACTIVAR_2FA_FALLIDO']],
    );
    const nombres = new Set(acciones.map((a) => a.accion));
    const { rows: reinicios } = await db.query(
      `SELECT ip_origen FROM core.auth_auditoria_forense WHERE email_usuario = $1 AND accion = 'REINICIAR_2FA'`,
      [admin.email],
    );
    const conMetadatos = acciones.every((a) => a.ip_origen?.startsWith('10.20.') && a.user_agent === 'suite-2fa/1.0');
    registrar('CP-2FA-28', 'La bitácora registra activación, éxito, fallo, desactivación y reinicio con IP real y agente',
      ['ACTIVAR_2FA', 'LOGIN_2FA_EXITOSO', 'LOGIN_2FA_FALLIDO', 'DESACTIVAR_2FA'].every((n) => nombres.has(n)) && reinicios.length === 1 && conMetadatos,
      `acciones: ${[...nombres].join(', ')}`);
  } finally {
    if (creados.length > 0) {
      await db.query(`UPDATE core.auth_usuario SET activo = false, estado = 'INACTIVO' WHERE id = ANY($1)`, [creados.map((u) => u.id)]);
    }
    await db.end();
  }
}

await ejecutar().catch((error) => {
  registrar('CP-2FA-ERR', 'La suite terminó sin errores inesperados', false, error.stack || error.message);
});

const aprobados = resultados.casos.filter((c) => c.aprobado).length;
console.log('\n── Latencias observadas ──');
const porOperacion = Object.groupBy(resultados.latencias, (l) => l.operacion);
for (const [operacion, muestras] of Object.entries(porOperacion)) {
  const tiempos = muestras.map((m) => m.ms);
  console.log(`${operacion}: máx ${Math.max(...tiempos)} ms · promedio ${Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)} ms (n=${tiempos.length})`);
}
console.log(`\nResultado: ${aprobados}/${resultados.casos.length} casos aprobados`);
fs.writeFileSync(path.join(DIR, '2fa-results.json'), JSON.stringify(resultados, null, 2));
process.exit(aprobados === resultados.casos.length ? 0 : 1);
