import type { PoolClient } from "pg";

//
export interface IDatabaseAdapter {
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  releaseTransaction(): Promise<void>;
  query(query: string, params?: any[]): Promise<any>;
  end(): Promise<void>;
}