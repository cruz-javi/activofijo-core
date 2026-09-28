import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.LEGACY_DATABASE_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  options: '-c timezone=America/La_Paz',
});

async function seed() {
  console.log('🌱 Inicializando datos maestros y catálogo de activos UAGRM (legacy_demo)...');
  const client = await pool.connect();

  try {
    await client.query('SET search_path TO legacy_demo;');

    console.log('🧹 Limpiando tablas de activos anteriores...');
    await client.query('DELETE FROM in_det_asig;');
    await client.query('DELETE FROM in_asignado;');
    await client.query('DELETE FROM in_vehic;');
    await client.query('DELETE FROM in_activo;');
    await client.query('DELETE FROM in_empleado;');
    await client.query('DELETE FROM in_oficina;');
    await client.query('DELETE FROM in_modelo;');
    await client.query('DELETE FROM in_marca;');
    await client.query('DELETE FROM in_det_grp;');
    await client.query('DELETE FROM in_grupo;');
    await client.query('DELETE FROM in_estado;');
    await client.query('DELETE FROM in_condicion;');
    await client.query('DELETE FROM in_unidad;');
    await client.query('DELETE FROM in_gestion;');

    console.log('📅 Insertando gestión contable...');
    await client.query(`
      INSERT INTO in_gestion (cod_gest, gest_ini, gest_fin, vigente, activo)
      VALUES (2026, '2026-01-01', '2026-12-31', true, true);
    `);

    console.log('🏢 Insertando oficinas y facultades...');
    await client.query(`
      INSERT INTO in_oficina (cod_ofic, cod_dpto, des_dpto, nivel, tipo_act, activo) VALUES
      (10, 1, 'Rectorado y Vicerrectorado', 1, 'ADMINISTRATIVO', true),
      (20, 2, 'Dirección Administrativa y Financiera (DAF)', 2, 'ADMINISTRATIVO', true),
      (30, 3, 'Facultad de Cs. de la Computación y Telecomunicaciones (FICCT)', 2, 'ACADEMICO', true),
      (40, 4, 'Facultad de Ciencias Exactas y Tecnología', 2, 'ACADEMICO', true),
      (50, 5, 'Facultad de Ciencias de la Salud Humana (Medicina)', 2, 'ACADEMICO', true),
      (60, 6, 'Biblioteca Central Universitaria', 3, 'ACADEMICO', true);
    `);

    console.log('👥 Insertando funcionarios custodios...');
    await client.query(`
      INSERT INTO in_empleado (cod_emp, ci, nombres, apellidos, cargo, cod_ofic, estado, activo) VALUES
      (1001, '4521890', 'Javier', 'Cruz Rocha', 'Administrador de Seguridad TI', 20, 'ACTIVO', true),
      (2001, '3219804', 'José Miguel', 'Justiniano Moreno', 'Jefe Dpto. Activo Fijo', 20, 'ACTIVO', true),
      (3001, '6102941', 'Patricia', 'Vaca Suárez', 'Responsable de Activos FICCT', 30, 'ACTIVO', true),
      (3002, '5492103', 'Carlos', 'Romero Méndez', 'Encargado de Inventario DAF', 20, 'ACTIVO', true),
      (3003, '4892019', 'Marcelo', 'Arrien Quiroga', 'Jefe de Laboratorio Medicina', 50, 'ACTIVO', true);
    `);

    console.log('📦 Insertando grupos contables (NB-SABS)...');
    await client.query(`
      INSERT INTO in_grupo (cod_grupo, des_grupo, nivel, activo) VALUES
      (1, 'Edificaciones e Inmuebles', 1, true),
      (2, 'Muebles y Enseres de Oficina', 1, true),
      (3, 'Maquinaria y Equipo', 1, true),
      (4, 'Equipos de Computación y Comunicación', 1, true),
      (5, 'Vehículos Automotores', 1, true);
    `);

    console.log('📏 Insertando unidades de medida...');
    await client.query(`
      INSERT INTO in_unidad (cod_unidad, des_unidad, abrev, activo) VALUES
      (1, 'Pieza', 'PZA', true),
      (2, 'Juego', 'JGO', true),
      (3, 'Equipo', 'EQ', true);
    `);

    console.log('🔧 Insertando condiciones y estados...');
    await client.query(`
      INSERT INTO in_condicion (cod_cond, des_cond, activo) VALUES
      (1, 'NUEVO', true),
      (2, 'USADO', true),
      (3, 'DETERIORADO', true);

      INSERT INTO in_estado (cod_estado, des_estado, activo) VALUES
      (1, 'BUENO', true),
      (2, 'REGULAR', true),
      (3, 'MALO', true),
      (4, 'EN_REPARACION', true),
      (5, 'BAJA', true);
    `);

    console.log('🏷️ Insertando marcas y modelos...');
    await client.query(`
      INSERT INTO in_marca (cod_marca, des_marca, activo) VALUES
      (1, 'Dell Technologies', true),
      (2, 'Lenovo', true),
      (3, 'Toyota', true),
      (4, 'Cisco Systems', true),
      (5, 'Olympus', true),
      (6, 'Epson', true),
      (7, 'HP Enterprise', true),
      (8, 'Muebles Roble S.R.L.', true);

      INSERT INTO in_modelo (cod_modelo, cod_marca, des_modelo, activo) VALUES
      (1, 1, 'PowerEdge R750', true),
      (2, 2, 'ThinkPad T14 Gen 4', true),
      (3, 3, 'Hilux 4x4 Doble Cabina', true),
      (4, 4, 'Catalyst 9200', true),
      (5, 5, 'CX23 Binocular', true),
      (6, 6, 'EB-L200F Láser', true),
      (7, 7, 'LaserJet Enterprise M507', true),
      (8, 8, 'Ejecutivo Premier', true);
    `);

    console.log('💻 Insertando catálogo de activos institucionales...');
    await client.query(`
      INSERT INTO in_activo (nro_activo, cod_activo, descripcion, monto, fec_adqui, nro_serie, cod_grupo, cod_marca, cod_modelo, cod_unidad, cod_cond, cod_estado, cod_gest, activo) VALUES
      (1, 'UAGRM-FICCT-001', 'Servidor Rack Dell PowerEdge R750 Xeon 32GB RAM 2TB SSD', 45000.00, '2025-03-10', 'SN-DELL-891024', 4, 1, 1, 3, 1, 1, 2026, true),
      (2, 'UAGRM-DAF-002', 'Laptop Lenovo ThinkPad T14 Core i7 16GB RAM 512GB SSD', 9800.00, '2025-06-15', 'SN-LNV-449102', 4, 2, 2, 3, 1, 1, 2026, true),
      (3, 'UAGRM-REC-003', 'Camioneta Toyota Hilux 4x4 Blanco 2.8L Diésel', 245000.00, '2024-02-20', 'CHASIS-TOY-881920', 5, 3, 3, 3, 2, 2, 2026, true),
      (4, 'UAGRM-FICCT-004', 'Switch de Red Gestionable Cisco Catalyst 9200 48 Puertos PoE+', 18500.00, '2025-01-12', 'SN-CSCO-77192', 4, 4, 4, 3, 1, 1, 2026, true),
      (5, 'UAGRM-MED-005', 'Microscopio Óptico Binocular Olympus CX23 de Laboratorio', 28000.00, '2024-08-05', 'SN-OLY-22194', 3, 5, 5, 3, 1, 1, 2026, true),
      (6, 'UAGRM-FICCT-006', 'Proyector Láser Epson EB-L200F Full HD 4500 Lúmenes', 8200.00, '2024-11-18', 'SN-EPS-99104', 4, 6, 6, 3, 2, 2, 2026, true),
      (7, 'UAGRM-BIB-007', 'Escritorio Ejecutivo de Madera Roble con Sillón Ergonómico', 3400.00, '2023-09-14', 'MUE-ROB-0012', 2, 8, 8, 2, 1, 1, 2026, true),
      (8, 'UAGRM-DAF-008', 'Impresora Láser Monocromática HP LaserJet Enterprise M507', 4600.00, '2024-04-22', 'SN-HP-331049', 4, 7, 7, 3, 2, 2, 2026, true),
      (9, 'UAGRM-MED-009', 'Equipo de Centrifugado Clínico para Análisis Bioquímico', 16800.00, '2023-05-30', 'SN-MED-55019', 3, 5, 5, 3, 3, 4, 2026, true),
      (10, 'UAGRM-EXA-010', 'Osciloscopio Digital de Laboratorio 4 Canales 100MHz', 12300.00, '2024-10-02', 'SN-OSC-44019', 3, 1, 1, 3, 2, 1, 2026, true),
      (11, 'UAGRM-DAF-011', 'Servidor de Archivos Legacy PowerEdge Generación Anterior', 22000.00, '2019-07-15', 'SN-DELL-11029', 4, 1, 1, 3, 3, 3, 2026, true),
      (12, 'UAGRM-FICCT-012', 'Lote de Estación de Trabajo Laboratorio de Redes ThinkPad', 42000.00, '2025-04-10', 'SN-LOTE-FICCT-01', 4, 2, 2, 1, 1, 1, 2026, true);
    `);

    console.log('📋 Registrando asignaciones de custodia vigentes...');
    await client.query(`
      INSERT INTO in_asignado (cod_asig, cod_ofic, cod_resp, fecha_asig, estado, tipo_asig, documento_respaldo, observacion, activo) VALUES
      (1, 30, 3001, '2025-03-15', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-FICCT-001', 'Asignación Sala de Servidores FICCT', true),
      (2, 20, 3002, '2025-06-18', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-DAF-002', 'Custodia equipo portátil DAF', true),
      (3, 10, 2001, '2024-02-25', 'VIGENTE', 'OFICIAL', 'ACTA-PB14-REC-003', 'Vehículo asignado a Dpto. Activo Fijo / Rectorado', true),
      (4, 30, 3001, '2025-01-15', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-FICCT-004', 'Switch centro de cómputo FICCT', true),
      (5, 50, 3003, '2024-08-10', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-MED-005', 'Laboratorio de Histología Medicina', true),
      (6, 30, 3001, '2024-11-20', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-FICCT-006', 'Aula Magna FICCT', true),
      (7, 60, 3002, '2023-09-18', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-BIB-007', 'Oficina de Jefatura de Biblioteca', true),
      (8, 20, 3002, '2024-04-25', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-DAF-008', 'Área de Contabilidad DAF', true),
      (9, 50, 3003, '2023-06-05', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-MED-009', 'En servicio técnico para calibración', true),
      (10, 40, 1001, '2024-10-05', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-EXA-010', 'Laboratorio de Telecomunicaciones', true),
      (11, 20, 1001, '2019-07-20', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-DAF-011', 'Pendiente de trámite de baja técnica', true),
      (12, 30, 3001, '2025-04-15', 'VIGENTE', 'INDIVIDUAL', 'ACTA-PB14-FICCT-012', 'Laboratorio 3 de Sistemas FICCT', true);

      INSERT INTO in_det_asig (cod_asig, nro_activo, cantidad, observacion, activo) VALUES
      (1, 1, 1, 'En operación continua rack principal', true),
      (2, 2, 1, 'Uso institucional administrativo', true),
      (3, 3, 1, 'Inspecciones periódicas de campo', true),
      (4, 4, 1, 'Conectividad red dorsal', true),
      (5, 5, 1, 'Prácticas académicas e investigación', true),
      (6, 6, 1, 'Equipamiento audiovisual', true),
      (7, 7, 1, 'Mobiliario administrativo', true),
      (8, 8, 1, 'Impresión documental de trámites', true),
      (9, 9, 1, 'Avería mecánica en motor de giro', true),
      (10, 10, 1, 'Docencia e investigación de física aplicada', true),
      (11, 11, 1, 'Obsolescencia técnica por fin de vida útil', true),
      (12, 12, 1, 'Laboratorio de desarrollo de software', true);
    `);

    console.log('✅ Catálogo institucional UAGRM poblado con éxito.');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('❌ Error al poblar catálogo:', err);
  process.exit(1);
});
