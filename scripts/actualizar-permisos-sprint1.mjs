import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: DIRECT_DATABASE_URL o DATABASE_URL no encontrada en el .env');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('🔗 Conectando a la base de datos PostgreSQL...');
  await client.connect();

  try {
    await client.query('SET search_path TO core;');

    console.log('🧹 Limpiando permisos obsoletos y futuros de auth_rol_permiso...');
    const permisosValidos = [
      'usuarios:gestionar',
      'roles:gestionar',
      'bitacora:consultar',
      'activos:consultar',
      'activos:crear',
      'activos:editar',
      'reportes:generar',
      'etiquetas:gestionar',
    ];

    // 1. Eliminar vínculos de permisos que ya no pertenecen al Sprint 1
    await client.query(`
      DELETE FROM auth_rol_permiso 
      WHERE permiso_id NOT IN (${permisosValidos.map((p) => `'${p}'`).join(', ')});
    `);

    // 2. Eliminar permisos que no pertenecen al Sprint 1
    await client.query(`
      DELETE FROM auth_permiso 
      WHERE id NOT IN (${permisosValidos.map((p) => `'${p}'`).join(', ')});
    `);

    console.log('✨ Registrando los 8 permisos oficiales del Sprint 1 en auth_permiso...');
    const permisosData = [
      { id: 'usuarios:gestionar', modulo: 'IDENTIDAD_ACCESO', descripcion: 'Creación, edición y administración de usuarios' },
      { id: 'roles:gestionar', modulo: 'IDENTIDAD_ACCESO', descripcion: 'Creación de roles y asignación de permisos dinámicos' },
      { id: 'bitacora:consultar', modulo: 'IDENTIDAD_ACCESO', descripcion: 'Consulta y visualización forense de auditoría' },
      { id: 'activos:consultar', modulo: 'PATRIMONIO', descripcion: 'Consulta del catálogo general y fichas técnicas de bienes' },
      { id: 'activos:crear', modulo: 'PATRIMONIO', descripcion: 'Formulario de alta e incorporación de activos' },
      { id: 'activos:editar', modulo: 'PATRIMONIO', descripcion: 'Modificación de características y datos de activos' },
      { id: 'reportes:generar', modulo: 'PATRIMONIO', descripcion: 'Generación y exportación de reportes oficiales (PDF/Excel)' },
      { id: 'etiquetas:gestionar', modulo: 'CODIFICACION', descripcion: 'Generación de códigos QR/128, plantillas y reposición' },
    ];

    for (const p of permisosData) {
      await client.query(`
        INSERT INTO auth_permiso (id, modulo, descripcion)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          modulo = EXCLUDED.modulo,
          descripcion = EXCLUDED.descripcion;
      `, [p.id, p.modulo, p.descripcion]);
    }

    console.log('🛡️ Sincronizando permisos de roles base del sistema...');
    
    // ADMINISTRADOR: Todos los 8 permisos
    await client.query(`
      INSERT INTO auth_rol_permiso (rol_id, permiso_id)
      SELECT 'ADMINISTRADOR', id FROM auth_permiso
      ON CONFLICT DO NOTHING;
    `);

    // JEFE_ACTIVO_FIJO: Activos, reportes, etiquetas y bitácora
    const permisosJefe = [
      'activos:consultar',
      'activos:crear',
      'activos:editar',
      'reportes:generar',
      'etiquetas:gestionar',
      'bitacora:consultar',
    ];
    for (const pId of permisosJefe) {
      await client.query(`
        INSERT INTO auth_rol_permiso (rol_id, permiso_id)
        VALUES ('JEFE_ACTIVO_FIJO', $1)
        ON CONFLICT DO NOTHING;
      `, [pId]);
    }

    // FUNCIONARIO: Consulta básica de catálogo
    await client.query(`
      INSERT INTO auth_rol_permiso (rol_id, permiso_id)
      VALUES ('FUNCIONARIO', 'activos:consultar')
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ Permisos y roles sincronizados exitosamente con el catálogo del Sprint 1.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Error al actualizar permisos:', err);
  process.exit(1);
});
