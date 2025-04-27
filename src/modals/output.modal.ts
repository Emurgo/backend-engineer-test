import type { PoolClient, Pool } from "pg"
import Dbclient from "../utilities/database/client"

//
import type { IOutput } from "../interfaces/output.interface"
import type { IInput } from "../interfaces/input.interface";
import type { IDatabaseAdapter } from "../interfaces/database.interface";

//
const getUnspentOutputsByTransactionInput = async (input: IInput): Promise<IOutput> => {
  const pool: Pool = Dbclient.get();
  //
  const query = `
    SELECT *
    FROM outputs
    WHERE transaction_id = $1 AND index = $2 AND spent_in_height IS NULL
  `;
  const params = [input.txId, input.index];
  const result = await pool.query(query, params);

  if (result.rowCount === 0) {
    throw new Error(`No UTXO was found with ID ${input.txId} and index ${input.index}`);
  }

  return {
    address: result.rows[0].address,
    value: parseFloat(result.rows[0].value),
  };
}

//
const createUnspentOutput = async (blockId: string, height: number, txId: string, outputPosition: number, output: IOutput, databaseAdapter: IDatabaseAdapter): Promise<void> => {
  const query = `
    INSERT INTO outputs (block_id, height, transaction_id, index, address, value)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  const params = [blockId, height, txId, outputPosition, output.address, output.value];
  const result = await databaseAdapter.query(query, params);

  if (result.rowCount === 0) {
    throw new Error(`Transaction ID ${txId} with index ${outputPosition} already exists`);
  }
}

//
const updateUnSpentOutput = async (blockId: string, height: number, input: IInput, txId: string, databaseAdapter: IDatabaseAdapter): Promise<IOutput> => {
  // Lock the output record for the current input
  const lockQuery = `
    SELECT *
    FROM outputs
    WHERE transaction_id = $1 AND index = $2 AND spent_in_height IS NULL
    FOR UPDATE;
  `;
  const lockResult = await databaseAdapter.query(lockQuery, [input.txId, input.index]);
  
  // If no rows returned, cannot lock the record
  if (lockResult.rowCount === 0) {
    throw new Error(`Failed to lock output: txId=${input.txId}, index=${input.index}`);
  }

  // update the lock output record to mark the spent with the current txId
  const updateQuery = `
    UPDATE outputs
    SET 
      spent_in_transaction = $1,
      spent_in_height = $2
    WHERE transaction_id = $3 AND index = $4 AND spent_in_height IS NULL;
  `;
  const updateResult = await databaseAdapter.query(updateQuery, [blockId, height, input.txId, input.index]);

  // If no rows were updated, it means the condition was not met
  if (updateResult.rowCount === 0) {
    throw new Error(`Failed to update output: txId=${input.txId}, index=${input.index}`);
  }

  //
  return {
    address: lockResult.rows[0].address,
    value: lockResult.rows[0].value,
  }
}

//
const deleteOutputs = async (height: number, databaseAdapter: IDatabaseAdapter): Promise<void> => {
  //
  const params =  [height];
  const deleteQuery = `
    DELETE 
    FROM outputs
    WHERE
      height > $1
  `
  const deleteResult = await databaseAdapter.query(deleteQuery, params);
  if (deleteResult.rowCount === 0) {
    throw new Error(`Failed to delete outputs with height greater than ${height}`);
  }

  const updateQuery = `
    UPDATE outputs
    SET 
      spent_in_transaction = NULL,
      spent_in_height = NULL
    WHERE
      spent_in_height > $1
  `;
  const updateResult = await databaseAdapter.query(updateQuery, params);
  if (updateResult.rowCount === 0) {
    throw new Error(`Failed to update outputs with spent_in_height greater than ${height}`);
  }
}

//
export default {
  getUnspentOutputsByTransactionInput,
  createUnspentOutput,
  updateUnSpentOutput,
  deleteOutputs
}