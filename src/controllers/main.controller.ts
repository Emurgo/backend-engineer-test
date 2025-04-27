//
import type { FastifyRequest, FastifyReply } from "fastify";
import type { Pool, PoolClient } from "pg";

//
import Logger from '../utilities/logger';
import { PostgresAdapter } from "../utilities/database/postgres.adapter";

//
import type { IBlock } from "../interfaces/block.interface";

//
import BlockService from "../services/block.service";
import LedgerService from "../services/ledger.service";

//
const	createBlock = async (req: FastifyRequest, res: FastifyReply) => {
  let databaseAdapter = null;
  try {
    //
    const block = req.body as IBlock;
    
    const validationResult = await BlockService.validateBlockInformation(block);

    if (!validationResult.success) {
      Logger.error(validationResult.response);
      return res.status(400).send({
        message: validationResult.response
      })
    }

    databaseAdapter = new PostgresAdapter();

    // check if the block is valid
    const blockCreateResult =	await BlockService.createBlock(block, databaseAdapter);
    if (!blockCreateResult.success) {
      Logger.error(blockCreateResult.response);
      return res.status(400).send({
        message: blockCreateResult.response
      })
    }

    //
    return res.status(200).send({
      message: blockCreateResult.response,
    });

  } catch (error: any) {
    Logger.error(error);
    res.status(500).send({
      message: error?.message ?? "Internal Server Error"
    });
  } finally {
    await databaseAdapter?.end();
  }
}

//
const getBalanceByAddress = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { address } = req.params as { address: string };

    if (!address) {
      return res.status(400).send({
        message: "Address is required"
      });
    }

    const result = await LedgerService.getBalanceByAddress(address);

    if (!result.success) {
      return res.status(400).send({
        message: result.response
      });
    }

    return res.status(200).send({
      balance: result.response,
    });

  } catch (error) {
    Logger.error('', error);
    res.status(500).send({
      message: "Internal Server Error"
    });
  }
}

//
const rollback = async (req: FastifyRequest, res: FastifyReply) => {
  let databaseAdapter = null;
  try {
    // Extract the height parameter from the query string
    const { height } = req.query as { height?: string };

    // Validate the height parameter
    if (!height || isNaN(Number(height))) {
      return res.status(400).send({
        message: "Invalid or missing query parameter",
      });
    }

    // Convert height to a number
    const heightNumber = Number(height);

    databaseAdapter = new PostgresAdapter();

    // Perform rollback logic here (e.g., call a service)
    const result = await BlockService.rollback(heightNumber, databaseAdapter);
    if (!result.success) {
      Logger.error(result.response);
      return res.status(400).send({
        message: result.response
      })
    }

    return res.status(200).send({
      message: result.response ?? `Rollback to height ${heightNumber} successful`,
    });
  } catch (error) {
    Logger.error('', error);
    res.status(500).send({
      message: "Internal Server Error",
    });
  } finally {
    await databaseAdapter?.end();
  }
}

//
export default {
  createBlock,
  getBalanceByAddress,
  rollback
};