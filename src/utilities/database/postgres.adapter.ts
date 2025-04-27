//
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { Pool } from 'pg';

//
import Logger from '../logger'

//
import type { IDatabaseAdapter } from '../../interfaces/database.interface';

//
export class PostgresAdapter implements IDatabaseAdapter {
  //
  private poolInstance: Pool | null = null;
  private client: PoolClient | null = null;

  //
  constructor () {
    //
	  const databaseUrl = `${process.env.DATABASE_URL}`;
    const databaseName = `${process.env.DB_NAME}`;

    console.log("DATABASE_URL", databaseUrl);
    console.log("DB_NAME", databaseName);

    try {
      //
      this.poolInstance = new Pool({
        connectionString: `${databaseUrl}/${databaseName}`,
      });

      Logger.info('Database pool initialized successfully.');
    } catch (error) {
      Logger.error('Failed to initialize the database pool:', error);
      this.poolInstance = null;
      throw new Error('Database connection failed.');
    }
  }

  //
  async beginTransaction(): Promise<void> {
    if (!this.poolInstance) {
      throw new Error('Database pool is not initialized');
    }
    //
    this.client = await this.poolInstance.connect();

    //
    await this.client.query("BEGIN");
    await this.client.query(`SELECT pg_advisory_xact_lock($1)`, [parseInt(process.env.LOCK_KEY ?? "12345")]);
  }

  //
  async commitTransaction(): Promise<void> {
    if (!this.client) {
      throw new Error('Client is not initialized');
    }
    await this.client.query("COMMIT");
  }

  //
  async rollbackTransaction(): Promise<void> {
    if (!this.client) {
      throw new Error('Client is not initialized');
    }
    await this.client.query("ROLLBACK");
  }

  //
  async releaseTransaction(): Promise<void> {
    if (!this.client) {
      throw new Error('Client is not initialized');
    }
    this.client.release();
    this.client = null;
  }

  //
  async query<T extends QueryResultRow>(query: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.client) {
      throw new Error('No active client to execute the query');
    }

    try {
      const result = await this.client.query<T>(query, params);
      return result;
    } catch (error) {
      throw new Error(`Query failed: ${error}`);
    }
  }

  //
  async end(): Promise<void> {
    if (this.poolInstance) {
      await this.poolInstance.end();
      this.poolInstance = null;
    }
  }

}