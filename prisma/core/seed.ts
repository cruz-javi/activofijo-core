import 'dotenv/config';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL");
}

const pool = new Pool({ connectionString });

async function main() {
  console.log('🌱 Iniciando seeder de la base de datos (Nativo / Core)...');

  const client = await pool.connect();
  try {
    // Forzar el schema a core
    await client.query('SET search_path TO core;');

    console.log('🧹 Limpiando datos anteriores...');
    await client.query('DELETE FROM auth_usuario_rol;');
    await client.query('DELETE FROM auth_usuario;');
    await client.query('DELETE FROM auth_rol;');

    console.log('🔨 Creando roles...');
    await client.query(`
      INSERT INTO auth_rol (id, nombre, descripcion, es_sistema) VALUES
      ('ADMIN', 'Administrador del Sistema', 'Acceso total a todos los módulos', true),
      ('ENCARGADO_ACTIVO', 'Encargado de Activo Fijo', 'Gestión de activos', false),
      ('AUDITOR', 'Auditor Externo', 'Acceso de solo lectura', false);
    `);

    console.log('🔑 Generando hash de contraseña...');
    const passwordHash = await argon2.hash('Uagrm2026*');

    console.log('👤 Creando usuarios...');
    // Generamos UUIDs
    const idAdmin = '11111111-1111-1111-1111-111111111111';
    const idEncargado = '22222222-2222-2222-2222-222222222222';
    const idAuditor = '33333333-3333-3333-3333-333333333333';

    await client.query(`
      INSERT INTO auth_usuario (id, email, password_hash, nombre_completo, cargo_institucional, codigo_empleado_legado) VALUES
      ($1, 'admin@uagrm.edu.bo', $4, 'Javier Cruz (Admin)', 'Jefe de Sistemas - Activo Fijo', 1001),
      ($2, 'operador@uagrm.edu.bo', $4, 'Olga Ribera Diez', 'Encargada de Inventario', 4556),
      ($3, 'auditor@uagrm.edu.bo', $4, 'José Miguel Justiniano', 'Auditor Financiero', 9168);
    `, [idAdmin, idEncargado, idAuditor, passwordHash]);

    console.log('🔗 Asignando roles a usuarios...');
    await client.query(`
      INSERT INTO auth_usuario_rol (usuario_id, rol_id) VALUES
      ($1, 'ADMIN'),
      ($2, 'ENCARGADO_ACTIVO'),
      ($3, 'AUDITOR');
    `, [idAdmin, idEncargado, idAuditor]);

    console.log('✅ Usuarios creados con éxito.');
    console.log('================================================');
    console.log('CREDENCIALES DE PRUEBA:');
    console.log('================================================');
    console.log('1. Admin      | Email: admin@uagrm.edu.bo    | Pass: Uagrm2026*');
    console.log('2. Encargado  | Email: operador@uagrm.edu.bo | Pass: Uagrm2026*');
    console.log('3. Auditor    | Email: auditor@uagrm.edu.bo  | Pass: Uagrm2026*');
    console.log('================================================');

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
