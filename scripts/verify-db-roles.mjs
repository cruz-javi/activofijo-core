import pg from 'pg';
const { Client } = pg;

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

async function testMigratorRole(connStr) {
  const client = new Client({ connectionString: connStr });
  await client.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS core._test_migrator_ddl (id serial primary key);');
    await client.query('DROP TABLE IF EXISTS core._test_migrator_ddl;');
    console.log('[PASS] migrator: DDL permitted on schema core');
  } finally {
    await client.end();
  }
}

async function testAppRwRole() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const database = process.env.DB_NAME || 'activofijo';

  const client = new Client({
    host,
    port,
    database,
    user: 'app_rw',
    password: 'app_rw_secret',
  });

  await client.connect();
  try {
    let ddlBlocked = false;
    try {
      await client.query('CREATE TABLE core._test_app_rw_fail (id int);');
    } catch {
      ddlBlocked = true;
      console.log('[PASS] app_rw: DDL blocked as expected');
    }

    if (!ddlBlocked) {
      throw new Error('Security violation: app_rw was able to execute DDL');
    }
  } finally {
    await client.end();
  }
}

async function testLegacyRoRole() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const database = process.env.DB_NAME || 'activofijo';

  const client = new Client({
    host,
    port,
    database,
    user: 'legacy_ro',
    password: 'legacy_ro_secret',
  });

  await client.connect();
  try {
    const res = await client.query('SELECT count(*) FROM legacy_demo.bienes_patrimoniales;');
    console.log(`[PASS] legacy_ro: read ${res.rows[0].count} rows from legacy_demo`);

    let insertBlocked = false;
    try {
      await client.query(`
        INSERT INTO legacy_demo.bienes_patrimoniales 
        (codigo_antiguo, descripcion_bien, categoria, ubicacion_edificio, ubicacion_aula, responsable_nombre)
        VALUES ('TEST-ILLEGAL', 'Description', 'Category', 'Edificio', 'Aula', 'Tester');
      `);
    } catch {
      insertBlocked = true;
      console.log('[PASS] legacy_ro: INSERT blocked as expected');
    }

    if (!insertBlocked) {
      throw new Error('Security violation: legacy_ro was able to execute INSERT');
    }
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    if (connectionString) {
      await testMigratorRole(connectionString);
    }
    if (!process.env.DIRECT_DATABASE_URL) {
      await testAppRwRole();
      await testLegacyRoRole();
    }
    console.log('[AUDIT SUCCESS] Database permissions verified');
    process.exit(0);
  } catch (error) {
    console.error('[AUDIT FAILED]', error.message);
    process.exit(1);
  }
}

main();
