import type { PoolClient } from 'pg';
import type { IDatabaseAdapter } from '../interfaces/database.interface';

//
const createTransaction = async (blockId: string, height: number, txId: string, databaseAdapter: IDatabaseAdapter): Promise<void> => {
  const query = `
    INSERT INTO transactions (txId, block_id, height)
    VALUES ($1, $2, $3)
  `
  const params = [txId, blockId, height];
  const result = await databaseAdapter.query(query, params);

  if (result.rowCount === 0) {
    throw new Error(`Transaction ${txId} already exists`);
  }
}

//
const deleteTransactions = async (height: number, databaseAdapter: IDatabaseAdapter): Promise<void> => {
  const query = `
    UPDATE transactions
    SET deleted_at = NOW()
    WHERE
      height > $1
  `;
  const result = await databaseAdapter.query(query, [height]);
  if (result.rowCount === 0) {
    throw new Error(`No transactions found with height greater than ${height}`);
  }
}

//
export default {
  createTransaction,
  deleteTransactions
}