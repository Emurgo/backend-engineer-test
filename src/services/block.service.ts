import type { Pool, PoolClient } from "pg";
import Dbclient from "../utilities/database/client";
import Helper from "../utilities/helper";
import Logger from '../utilities/logger';

//
import type { IBlock } from "../interfaces/block.interface";
import type { IResponse } from "../interfaces/response.interface";
import type { IOutput } from "../interfaces/output.interface";
import type { IDatabaseAdapter } from "../interfaces/database.interface";

//
import TransactionService from "../services/transaction.service";

//
import BlockModal from "../modals/block.modal";

//
const validateBlockInformation = async (block: IBlock): Promise<IResponse<string>> => { 
  try {
    const { id, height, transactions } = block;
    let stringForHash = "";

    const isGenesis = await Helper.isGenesisBlock(block);

    // get the current height from the database
    const currentHeight = await BlockModal.getCurrentHeight(isGenesis);

    // validate block height
    if (!await Helper.validateBlockHeight(block, currentHeight, isGenesis)) {
      return {
        success: false,
        response: "Invalid height"
      }
    }
    stringForHash = height.toString();

    // Create a hashmap for all the outputs in the current block
    const utxoMap = new Map<string, IOutput>();
    for (const tx of transactions) {
      tx.outputs.forEach((output, index) => {
        const key = `${tx.id}:${index}`;
        utxoMap.set(key, output);
      });
    }
    const spentUtxo = new Set<string>();

    // validate total balance of each transaction in the block
    for(const element of transactions) {
      const isCoinbase = await TransactionService.isCoinbaseTransaction(element); 
      if (!isGenesis && !isCoinbase) {
        const isValidTransaction = await TransactionService.validateTransactionBalance(element, utxoMap, spentUtxo);
        if (!isValidTransaction.success) {
          return {
            success: false,
            response: typeof isValidTransaction?.response === 'string' ?  isValidTransaction.response : "Invalid transaction balance"
          }
        }
      }
      stringForHash = `${stringForHash}${element.id}`;
    }

    // validate block id
    const hash = Helper.hash(stringForHash, 'sha-256');
    console.log(stringForHash, hash);

    if (id !== hash) {
      return {
        success: false,
        response: "Invalid block Id"
      }
    }

    //
    return {
      success: true,
      response: "success"
    };
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error.message ?? 'Unknown error while validating block information'
    };
  }
}

//
const getCurrentHeight = async (): Promise<IResponse<string | number>> => {
  try {
    const height = await BlockModal.getCurrentHeight();
    if (height === null) {
      return {
        success: false,
        response: 'No height was found'
      }
    }

    return {
      success: true,
      response: height
    }
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error.message ?? 'Unknown error while trying to get current height'
    }
  }
}

//
const createBlock = async (block: IBlock, databaseAdapter: IDatabaseAdapter): Promise<IResponse<string>> => {
  //
  const { id: blockId, height, transactions } = block;
  let transactionStarted = false;

  //
  try {
    //
    await databaseAdapter.beginTransaction();
    transactionStarted = true;

    for(const txn of transactions) {
      // create transactions
      const createTransactionResult = await TransactionService.createTransaction(blockId, height, txn, databaseAdapter);
      if (!createTransactionResult.success) {
        throw new Error(createTransactionResult.response ?? 'Failed to create transaction');
      }
    }

    // insert block
    await BlockModal.createBlock(block, databaseAdapter);

    await databaseAdapter.commitTransaction();

    return {
      success: true,
      response: "Block Created successfully",
    }
  } catch (error: any) {
    if (transactionStarted) {
      await databaseAdapter.rollbackTransaction();
    }
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? "Unknown error occurred while creating block",
    }
  } finally {
    await databaseAdapter.releaseTransaction();
  }
}

//
const rollback = async (height: number, databaseAdapter: IDatabaseAdapter): Promise<IResponse<string>> => {
  //
  let transactionStarted = false;

  try {
    //
    await databaseAdapter.beginTransaction();

    //
    const deleteTransactionResult = await TransactionService.deleteTransactions(height, databaseAdapter);
    if (!deleteTransactionResult.success) {
      throw new Error(deleteTransactionResult.response ?? 'Failed to delete transaction')
    }

    await BlockModal.deleteBlock(height, databaseAdapter);

    //
    await databaseAdapter.commitTransaction();
    return {
      success: true,
      response: `Height rollback to ${height}`
    }
  } catch (error: any) {
    if (transactionStarted) {
      await databaseAdapter.rollbackTransaction();
    }
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? "Unknown error occurred while creating block",
    }
  } finally {
    await databaseAdapter.releaseTransaction();
  }
}

//
export default {
  validateBlockInformation,
  getCurrentHeight,
  createBlock,
  rollback,
};