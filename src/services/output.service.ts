import type { PoolClient } from 'pg';
import Logger from '../utilities/logger';

//
import type { IInput } from '../interfaces/input.interface';
import type { IOutput } from '../interfaces/output.interface';
import type { IResponse } from '../interfaces/response.interface';

//
import OutputModal from '../modals/output.modal';
import InputModal from '../modals/input.modal';

//
import LedgerService from './ledger.service';
import type { IDatabaseAdapter } from '../interfaces/database.interface';

//
const updateSpentOutputs = async (blockId: string, height: number, txId: string, inputs: IInput[], databaseAdapter: IDatabaseAdapter): Promise<IResponse<string>> => {
  try {
    for (const i in inputs) {
      // update a output to spent
      const updatedOutput = await OutputModal.updateUnSpentOutput(blockId, height, inputs[i], txId, databaseAdapter);
      // create input record
      await InputModal.createInput(blockId, height, txId, inputs[i], databaseAdapter);
      // debit the address
      const debitAddressResult = await LedgerService.debitAddress(updatedOutput, blockId, height, txId, parseInt(i), databaseAdapter);
      if (!debitAddressResult.success) {
        return {
          success: false,
          response: debitAddressResult.response ?? 'Failed to debit address',
        }
      }
    } 

    return {
      success: true,
      response: 'Outputs updated successfully',
    }
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? 'Unknown error occurred while updating outputs',  
    }
  }
}

//
const createUnspentOutputs = async (blockId: string, height: number, txId: string, outputs: IOutput[], databaseAdapter: IDatabaseAdapter): Promise<IResponse<string>> => {
  //
  try {
    for (const i in outputs) {
      // create an unspent output
      await OutputModal.createUnspentOutput(blockId, height, txId, parseInt(i), outputs[i], databaseAdapter);
      // credit the address
      const creditAddressResult = await LedgerService.creditAddress(outputs[i], blockId, height, txId, parseInt(i), databaseAdapter);
      if (!creditAddressResult.success) {
        return {
          success: false,
          response: creditAddressResult.response ?? 'Failed to credit address',
        }
      }
    }

    return {
      success: true,
      response: 'Outputs Created successfully',
    }

  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? 'Unknown error occurred while creating outputs',
    }
  }
}

//
const getUnspentOutputsByTransactionInput = async (input: IInput): Promise<IResponse<IOutput | string>> => {
  //
  try {
    const result = await OutputModal.getUnspentOutputsByTransactionInput(input);

    return {
      success: true,
      response: {
        address: result.address,
        value: result.value,
      },
    }
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? 'Unknown error occurred while fetching unspent outputs',
    };
  }
}

//
const deleteOutputs = async (height: number, databaseAdapter: IDatabaseAdapter): Promise<IResponse<string>> => {
  try {
  await InputModal.deleteInputs(height, databaseAdapter);
  await OutputModal.deleteOutputs(height, databaseAdapter);

  const result = await LedgerService.deleteByHeight(height, databaseAdapter);
  if (!result.success) {
    return {
      success: false,
      response: result.response ?? 'Failed to delete outputs'
    }
  }

  return {
    success: true,
    response: "Outputs deleted Successfully"
  }

  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? "Unknown error occurred while deleting outputs",
    }
  }
}

//
export default {
  updateSpentOutputs,
  createUnspentOutputs,
  getUnspentOutputsByTransactionInput,
  deleteOutputs
}