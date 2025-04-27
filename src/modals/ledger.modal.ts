import type { PoolClient, Pool } from "pg";
import Dbclient from "../utilities/database/client";
import type { IDatabaseAdapter } from "../interfaces/database.interface";

//
const creditAddress = async (address: string, value: number, blockId: string, height: number, txId: string, txIndex: number, databaseAdapter: IDatabaseAdapter): Promise<void> => {
  const query = `
    INSERT INTO ledgers (address, value, block_id, height, transaction_id, index, type)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;
  const params = [address, value, blockId, height, txId, txIndex, 'credit'];
  const result = await databaseAdapter.query(query, params);
  if (result.rowCount === 0) {
    throw new Error("Failed to credit address");
  }
}

//
const debitAddress = async (address: string, value: number, blockId: string, height: number, txId: string, txIndex: number, databaseAdapter: IDatabaseAdapter): Promise<void> => {
  const query = `
    INSERT INTO ledgers (address, value, block_id, height, transaction_id, index, type)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;
  const params = [address, value * -1, blockId, height, txId, txIndex, 'debit'];
  const result = await databaseAdapter.query(query, params);
  if (result.rowCount === 0) {
    throw new Error("Failed to debit address");
  }
}

//
const getBalanceByAddress = async (address: string): Promise<number | null> => {
  const pool: Pool = Dbclient.get();
  const query = `
    SELECT SUM(value) AS balance
    FROM ledgers
    WHERE 
      address = $1 AND
      deleted_at IS NULL
    GROUP BY address;
  `;
  const params = [address];
  const result = await pool.query(query, params);
  
  return result.rows.length > 0 ? parseFloat(result.rows[0].balance) : null;
}

//
const deleteByHeight = async (height: number, databaseAdapter: IDatabaseAdapter): Promise<void> => {
  //
  const query = `
    UPDATE ledgers
    SET
      deleted_at = NOW()
    WHERE
      height > $1
  `;
  const result = await databaseAdapter.query(query, [height]);
  if (result.rowCount === 0) {
    throw new Error("Failed to delete ledgers");
  }
}

//
export default {
  creditAddress,
  debitAddress,
  getBalanceByAddress,
  deleteByHeight
}