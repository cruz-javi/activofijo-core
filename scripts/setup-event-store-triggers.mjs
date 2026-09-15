import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

async function setupTrigger() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const sql = `
      CREATE OR REPLACE FUNCTION core.prevent_event_store_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
          RAISE EXCEPTION 'Event store is strictly append-only. UPDATE and DELETE are prohibited.';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_prevent_event_mutation ON core.event_store;
      CREATE TRIGGER trg_prevent_event_mutation
      BEFORE UPDATE OR DELETE ON core.event_store
      FOR EACH ROW EXECUTE FUNCTION core.prevent_event_store_mutation();
    `;
    await client.query(sql);
    console.log('[INFO] Event store immutability trigger created successfully');
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Failed to set up trigger:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupTrigger();
