import type { PoolClient } from "pg"

//
import Logger from "../utilities/logger";

//
import type { IResponse } from "../interfaces/response.interface";
import type { IOutput } from "../interfaces/output.interface";

//
import LedgerModal from "../modals/ledger.modal";
import type { IDatabaseAdapter } from "../interfaces/database.interface";

//
const creditAddress = async (output: IOutput, blockId: string, height: number, txId: string, OutputPosition: number, databaseAdapter: IDatabaseAdapter): Promise<IResponse<string>> => {
  try {
    await LedgerModal.creditAddress(output.address, output.value, blockId, height, txId, OutputPosition, databaseAdapter);

    return {
      success: true,
      response: 'Address credited successfully',
    }
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? 'Unknown error occurred while crediting address',
    }
  }
}

//
const debitAddress = async (output: IOutput, blockId: string, height: number, txId: string, inputPosition: number, databaseAdapter: IDatabaseAdapter): Promise<IResponse<string>> => {
  try {
    await LedgerModal.debitAddress(output.address, output.value, blockId, height, txId, inputPosition, databaseAdapter);

    return {
      success: true,
      response: 'Address debited successfully',
    }
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? 'Unknown error occurred while debiting address',
    }
  }

}

//
const getBalanceByAddress = async (address: string): Promise<IResponse<string | number>> => {
  try {
    //
    const result = await LedgerModal.getBalanceByAddress(address);
    if (result === null) {
      return {
        success: false,
        response: "Address not found"
      }
    }

    //
    return {
      success: true,
      response: result
    };
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? "Unknown error occurred while getting balance",
    }
  }
}

//
const deleteByHeight = async (height: number, databaseAdapter: IDatabaseAdapter): Promise<IResponse<string>> => {
  try {

    await LedgerModal.deleteByHeight(height, databaseAdapter);

    return {
      success: true,
      response: "Ledgers deleted successfully"
    }
  } catch (error: any) {
    Logger.error(error.message ?? 'Unknown Error', error);
    return {
      success: false,
      response: error?.message ?? "Unknown error occurred while deleting ledgers",
    }
  }
}

//
export default {
  creditAddress,
  debitAddress,
  getBalanceByAddress,
  deleteByHeight
}