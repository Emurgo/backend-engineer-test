import type { PoolClient } from 'pg';
import DbClient from "../utilities/database/client";

//
import type { IBlock } from '../interfaces/block.interface';
import type { IDatabaseAdapter } from '../interfaces/database.interface';

//
const createBlock = async (block: IBlock, databaseAdapter: IDatabaseAdapter): Promise<void> => {
  //
  if (block.height > 0) {
    const updateQuery = `
      UPDATE blocks SET is_tip = false WHERE is_tip = true;
    `;
    const updateResult = await databaseAdapter.query(updateQuery);
    if (updateResult.rowCount === 0) {
      throw new Error(`Failed to update ${block.id}`);
    }
  }

  const insertQuery = `
    INSERT INTO blocks (id, height, raw, is_tip)
    VALUES ($1, $2, $3, true);
  `;
  const params = [block.id, block.height, block];
  const result = await databaseAdapter.query(insertQuery, params);

  if (result.rowCount === 0) {
    throw new Error(`Block with ID ${block.id} already exists`);
  }
}

//
const getCurrentHeight = async (isGenesis: boolean = false): Promise<number | null> => {
  const pool = DbClient.get();

  const query = `
    SELECT id, height
    FROM blocks
    WHERE
      is_tip = true
    ORDER BY height DESC
    LIMIT 1
  `
  const result = await pool.query(query);

  if (result.rowCount === 0) {
    if (isGenesis) {
      return null;
    }
    throw new Error(`No height was found`);
  }

  return parseInt(result.rows[0]?.height) ?? null;
}

//
const deleteBlock = async (height: number, databaseAdapter: IDatabaseAdapter): Promise<void> => {
  //
  const params = [height];

  //
  const deleteBlocksQuery = `
    UPDATE blocks
    SET
      deleted_at = NOW(),
      is_tip = false
    WHERE
      height > $1
  `;
  const deleteResult = await databaseAdapter.query(deleteBlocksQuery, params);
  if (deleteResult.rowCount === 0) {
    throw new Error(`Failed to delete blocks with height greater than ${height}`);
  }

  //
  const setBlockTipQuery = `
    UPDATE blocks
      SET is_tip = true
    WHERE 
      height = $1
  `;
  const setResult = await databaseAdapter.query(setBlockTipQuery, params);
  if (setResult.rowCount === 0) {
    throw new Error(`Failed to set block with height ${height} as tip`);
  }

}

//
export default {
  createBlock,
  getCurrentHeight,
  deleteBlock
}