import { Pool } from 'pg';

export async function runMigrations(pool: Pool) {
  // Balance table migration
  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances (
      address TEXT PRIMARY KEY,
      balance NUMERIC(20,6) NOT NULL DEFAULT 0
    );
  `);

  console.log('✅ Migrations completed');
}
