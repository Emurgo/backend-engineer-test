import { Pool } from "pg";

async function createTables(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      height INT NOT NULL,
      block_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      block_id TEXT NOT NULL REFERENCES blocks(id),
      tx_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inputs (
      id SERIAL PRIMARY KEY,
      tx_id TEXT NOT NULL REFERENCES transactions(id),
      output_tx_id TEXT,
      output_index INT
    );

    CREATE TABLE IF NOT EXISTS outputs (
      id SERIAL PRIMARY KEY,
      tx_id TEXT NOT NULL REFERENCES transactions(id),
      address TEXT NOT NULL,
      value INT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS balances (
      address TEXT PRIMARY KEY,
      balance INT NOT NULL
    );
  `);
}

export async function createPool(): Promise<Pool> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  await createTables(pool);
  return pool;
}
