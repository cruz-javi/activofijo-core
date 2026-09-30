import 'dotenv/config';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL');
}

const pool = new Pool({
  connectionString,
  options: '-c timezone=America/La_Paz',
});

async function main() {
  console.log('🌱 Inicializando datos maestros institucionales UAGRM (Core)...');

  const client = await pool.connect();
  try {
    await client.query('SET search_path TO core;');

    console.log('🧹 Limpiando tablas de seguridad anteriores...');
    await client.query('DELETE FROM auth_auditoria_forense;');
    await client.query('DELETE FROM auth_usuario_rol;');
    await client.query('DELETE FROM auth_rol_permiso;');
    await client.query('DELETE FROM auth_refresh_token;');
    await client.query('DELETE FROM auth_usuario;');
    await client.query('DELETE FROM auth_rol;');
    await client.query('DELETE FROM auth_permiso;');

    console.log('📦 Registrando catálogo de permisos por módulo (Sprint 1)...');
    await client.query(`
      INSERT INTO auth_permiso (id, modulo, descripcion) VALUES
      ('usuarios:gestionar', 'IDENTIDAD_ACCESO', 'Creación, edición y administración de usuarios'),
      ('roles:gestionar', 'IDENTIDAD_ACCESO', 'Creación de roles y asignación de permisos dinámicos'),
      ('bitacora:consultar', 'IDENTIDAD_ACCESO', 'Consulta y visualización forense de auditoría'),
      ('activos:consultar', 'PATRIMONIO', 'Consulta del catálogo general y fichas técnicas de bienes'),
      ('activos:crear', 'PATRIMONIO', 'Formulario de alta e incorporación de activos'),
      ('activos:editar', 'PATRIMONIO', 'Modificación de características y datos de activos'),
      ('reportes:generar', 'PATRIMONIO', 'Generación y exportación de reportes oficiales (PDF/Excel)'),
      ('etiquetas:gestionar', 'CODIFICACION', 'Generación de códigos QR/128, plantillas y reposición');
    `);

    console.log('🏛️ Creando roles primordiales (UML UAGRM)...');
    await client.query(`
      INSERT INTO auth_rol (id, nombre, descripcion, es_sistema) VALUES
      ('ADMINISTRADOR', 'Administrador del Sistema', 'Acceso irrestricto, configuración, usuarios, roles y auditoría forense', true),
      ('JEFE_ACTIVO_FIJO', 'Jefe de Activo Fijo', 'Supervisión patrimonial, aprobaciones de altas, reportes y etiquetas', true),
      ('FUNCIONARIO', 'Funcionario Custodio', 'Consulta de catálogo de bienes y perfil institucional', true);
    `);

    console.log('🔗 Vinculando permisos granulares a los roles...');
    // ADMINISTRADOR tiene todos los permisos
    await client.query(`
      INSERT INTO auth_rol_permiso (rol_id, permiso_id)
      SELECT 'ADMINISTRADOR', id FROM auth_permiso;
    `);

    // JEFE_ACTIVO_FIJO tiene permisos de gestión patrimonial, reportes, etiquetas y bitácora
    await client.query(`
      INSERT INTO auth_rol_permiso (rol_id, permiso_id) VALUES
      ('JEFE_ACTIVO_FIJO', 'activos:consultar'),
      ('JEFE_ACTIVO_FIJO', 'activos:crear'),
      ('JEFE_ACTIVO_FIJO', 'activos:editar'),
      ('JEFE_ACTIVO_FIJO', 'reportes:generar'),
      ('JEFE_ACTIVO_FIJO', 'etiquetas:gestionar'),
      ('JEFE_ACTIVO_FIJO', 'bitacora:consultar');
    `);

    // FUNCIONARIO tiene acceso de consulta básica
    await client.query(`
      INSERT INTO auth_rol_permiso (rol_id, permiso_id) VALUES
      ('FUNCIONARIO', 'activos:consultar');
    `);

    console.log('🔑 Generando hash de contraseña oficial (Argon2id)...');
    const passwordHash = await argon2.hash('Uagrm2026*');

    console.log('👤 Creando usuarios institucionales primordiales...');
    const idAdmin = '11111111-1111-1111-1111-111111111111';
    const idJefe = '22222222-2222-2222-2222-222222222222';
    const idFuncionario = '33333333-3333-3333-3333-333333333333';

    await client.query(`
      INSERT INTO auth_usuario (id, email, password_hash, nombre_completo, cargo_institucional, codigo_empleado_legado) VALUES
      ($1, 'admin@uagrm.edu.bo', $4, 'Javier Cruz', 'Administrador del Sistema', 1001),
      ($2, 'jefe@uagrm.edu.bo', $4, 'Ing. José Miguel Justiniano M.', 'Jefe Departamento de Activo Fijo', 2001),
      ($3, 'funcionario@uagrm.edu.bo', $4, 'Lic. Patricia Vaca Suárez', 'Responsable de Activos - FICCT', 3001);
    `, [idAdmin, idJefe, idFuncionario, passwordHash]);

    console.log('🎖️ Asignando roles oficiales a los usuarios...');
    await client.query(`
      INSERT INTO auth_usuario_rol (usuario_id, rol_id) VALUES
      ($1, 'ADMINISTRADOR'),
      ($2, 'JEFE_ACTIVO_FIJO'),
      ($3, 'FUNCIONARIO');
    `, [idAdmin, idJefe, idFuncionario]);

    console.log('✅ Seed completado exitosamente.');
    console.log('================================================================');
    console.log('ACTORES PRIMORDIALES UAGRM (Credenciales de Acceso):');
    console.log('================================================================');
    console.log('1. ADMINISTRADOR:');
    console.log('   - Correo: admin@uagrm.edu.bo | Código: 1001');
    console.log('   - Nombre: Javier Cruz');
    console.log('   - Clave:  Uagrm2026*');
    console.log('----------------------------------------------------------------');
    console.log('2. JEFE DE ACTIVO FIJO:');
    console.log('   - Correo: jefe@uagrm.edu.bo | Código: 2001');
    console.log('   - Nombre: Ing. José Miguel Justiniano M.');
    console.log('   - Clave:  Uagrm2026*');
    console.log('----------------------------------------------------------------');
    console.log('3. FUNCIONARIO CUSTODIO:');
    console.log('   - Correo: funcionario@uagrm.edu.bo | Código: 3001');
    console.log('   - Nombre: Lic. Patricia Vaca Suárez');
    console.log('   - Clave:  Uagrm2026*');
    console.log('================================================================');
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seeder:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
