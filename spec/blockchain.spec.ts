import { Pool } from "pg";
import {
  validateBlock,
  processBlock,
  rollbackBlocks,
} from "../src/services/blockchain";
import { increaseBalance, decreaseBalance } from "../src/services/balances";
import { createHash } from "crypto";

jest.mock("pg");
jest.mock("../src/services/balances");

const mockPool = {
  query: jest.fn(),
} as unknown as Pool;

describe("Blockchain Service Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateBlock", () => {
    it("validates block height correctly", async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ max: 1 }],
      });

      const block = {
        id: createHash("sha256").update("2").digest("hex"),
        height: 2,
        transactions: [],
      };

      await expect(validateBlock(block, mockPool)).resolves.not.toThrow();
    });

    it("throws error for incorrect block height", async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ max: 2 }],
      });

      const block = { height: 4, transactions: [] };

      await expect(validateBlock(block, mockPool)).rejects.toThrow(
        "Invalid block height: expected 3, got 4"
      );
    });

    it("throws error when input/output sums do not match", async () => {
      const block = {
        height: 2,
        id: createHash("sha256").update("2tx1").digest("hex"),
        transactions: [
          {
            id: "tx1",
            inputs: [{ txId: "tx0", index: 0 }],
            outputs: [{ address: "addr1", value: 50 }],
          },
        ],
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ max: 1 }],
      });

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ value: 40 }],
      });

      await expect(validateBlock(block, mockPool)).rejects.toThrow(
        "Invalid transaction: inputs (40) do not match outputs (50)"
      );
    });
  });

  describe("processBlock", () => {
    it("processes block and updates balances", async () => {
      const block = {
        id: "block1",
        height: 2,
        transactions: [
          {
            id: "tx1",
            inputs: [{ txId: "tx0", index: 0 }],
            outputs: [{ address: "addr1", value: 50 }],
          },
        ],
      };

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ value: 50, address: "addr0" }] });

      await processBlock(block, mockPool);

      expect(increaseBalance).toHaveBeenCalledWith("addr1", 50, mockPool);
      expect(decreaseBalance).toHaveBeenCalledWith("addr0", 50, mockPool);
    });
  });

  describe("rollbackBlocks", () => {
    it("rolls back blocks correctly", async () => {
      const targetHeight = 1;

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: "block2" }] })
        .mockResolvedValueOnce({ rows: [{ id: "tx1" }] })
        .mockResolvedValueOnce({ rows: [{ address: "addr1", value: 50 }] })
        .mockResolvedValueOnce({
          rows: [{ output_tx_id: "tx0", output_index: 0 }],
        })
        .mockResolvedValueOnce({ rows: [{ value: 50, address: "addr0" }] });

      await rollbackBlocks(targetHeight, mockPool);

      expect(decreaseBalance).toHaveBeenCalledWith("addr1", 50, mockPool);
      expect(increaseBalance).toHaveBeenCalledWith("addr0", 50, mockPool);

      expect(mockPool.query).toHaveBeenCalledWith(
        "DELETE FROM outputs WHERE tx_id = $1",
        ["tx1"]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        "DELETE FROM inputs WHERE tx_id = $1",
        ["tx1"]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        "DELETE FROM transactions WHERE block_id = $1",
        ["block2"]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        "DELETE FROM blocks WHERE id = $1",
        ["block2"]
      );
    });

    it("throws error when no blocks to rollback", async () => {
      const targetHeight = 1;

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(rollbackBlocks(targetHeight, mockPool)).rejects.toThrow(
        `No blocks to rollback past height ${targetHeight}`
      );
    });
  });
});
