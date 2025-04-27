import type { PoolClient } from "pg";
import Logger from "../utilities/logger";

//
import type { IOutput } from "../interfaces/output.interface";
import type { ITransaction } from "../interfaces/transaction.interface";
import type { IResponse } from "../interfaces/response.interface";
import type { IDatabaseAdapter } from "../interfaces/database.interface";

import TransactionModal from "../modals/transaction.modal";
import OutputService from "../services/output.service";

//
const validateTransactionBalance = async (
  transaction: ITransaction, 
  utxoMap: Map<string, IOutput>,
  spentUtxo: Set<string>
): Promise<IResponse<IOutput | string>> => {
  try {
    // Get All Inputs of the transaction
    let inputTotal = 0;
    for (const input of transaction.inputs) {
      //
      const key = `${input.txId}:${input.index}`;
      // Double spend check
      if (spentUtxo.has(key)) {
        return {
          success: false,
          response: `Double spend found for txn: '${transaction.id}', input: ${key}`,
        };
      }

      let utxo = utxoMap.get(key);
      if (!utxo) {
        // Get the output of the input
        const result = await OutputService.getUnspentOutputsByTransactionInput(input);
        if (!result.success || typeof result.response === "string") {
          return result;
        }
        utxo = result.response;
      }

      // Mark as spent
      spentUtxo.add(key);
      inputTotal += utxo.value;
    }

    let outputTotal = 0;
    for (const output of transaction.outputs) {
      // Get the output of the input
      outputTotal += output.value;
    }

    if (inputTotal === outputTotal) {
      return {
        success: true,
        response: "",
      };
    }

    return {
      success: false,
      response: `Total Input not equal to total output for txn: '${transaction.id}'`,
    };
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? 'Unknown error while validating transaction balance'
    }
  }
}

//
const isCoinbaseTransaction = async (transaction: ITransaction): Promise<boolean> => {
  // how to verify that this is a coinbase transaction?
  return transaction.inputs.length === 0 && transaction.outputs.length === 1;
}

//
const createTransaction = async (blockId: string, height: number, txn: ITransaction, databaseAdapter: IDatabaseAdapter): Promise<IResponse<string>> => {
  //
  try {
    // Update outputs to spent
    const updateOutputRes = await OutputService.updateSpentOutputs(blockId, height, txn.id, txn.inputs, databaseAdapter);
    if (!updateOutputRes.success) {
      return {
        success: false,
        response: updateOutputRes.response ?? 'Failed to update outputs',
      }
    }

    // Create unspent outputs
    const createOutputRes = await OutputService.createUnspentOutputs(blockId, height, txn.id, txn.outputs, databaseAdapter);
    if (!createOutputRes.success) {
      return {
        success: false,
        response: createOutputRes.response ?? 'Failed to create outputs',
      }
    }

    // Create the transaction
    await TransactionModal.createTransaction(blockId, height, txn.id, databaseAdapter);

    return {
      success: true,
      response: "Transaction Created successfully",
    }
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? "Unknown error occurred while creating transaction",
    };
  }
}

//
const deleteTransactions = async (height: number, databaseAdapter: IDatabaseAdapter): Promise<IResponse<string>> => {
  try {
    const deleteOutputsResult = await OutputService.deleteOutputs(height, databaseAdapter);
    if (!deleteOutputsResult.success) {
      return {
        success: false,
        response: deleteOutputsResult.response ?? 'Failed to delete outputs'
      }
    }

    await TransactionModal.deleteTransactions(height, databaseAdapter);

    return {
      success: true,
      response: "Transaction deleted successfully",
    }
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? "Unknown error occurred while deleting transactions",
    }
  }
}

//
export default {
  validateTransactionBalance,
  isCoinbaseTransaction,
  createTransaction,
  deleteTransactions,
}