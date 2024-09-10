import {
  getBalance,
  increaseBalance,
  decreaseBalance,
} from "../src/services/balances";
import { Pool } from "pg";

const mockPool = {
  query: jest.fn(),
} as unknown as Pool;

describe("Balance Service Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBalance", () => {
    it("returns the balance of a valid address", async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ balance: 100 }],
      });

      const balance = await getBalance("addr1", mockPool);
      expect(balance).toBe(100);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT balance FROM balances WHERE address = $1",
        ["addr1"]
      );
    });

    it("returns null if the address does not exist", async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const balance = await getBalance("nonexistent_address", mockPool);
      expect(balance).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT balance FROM balances WHERE address = $1",
        ["nonexistent_address"]
      );
    });
  });

  describe("increaseBalance", () => {
    it("increases the balance of an address", async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await increaseBalance("addr1", 50, mockPool);

      expect(mockPool.query).toHaveBeenCalledWith(
        `INSERT INTO balances (address, balance) 
     VALUES ($1, $2) 
     ON CONFLICT (address) DO 
     UPDATE SET balance = balances.balance + EXCLUDED.balance`,
        ["addr1", 50]
      );
    });
  });

  describe("decreaseBalance", () => {
    it("decreases the balance of an address", async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ balance: 100 }],
      });

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await decreaseBalance("addr1", 50, mockPool);

      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        "SELECT balance FROM balances WHERE address = $1",
        ["addr1"]
      );

      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        `UPDATE balances 
     SET balance = balance - $1 
     WHERE address = $2`,
        [50, "addr1"]
      );
    });

    it("throws an error if the address does not exist", async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        decreaseBalance("nonexistent_address", 50, mockPool)
      ).rejects.toThrow(
        "Cannot decrease balance: Address nonexistent_address does not exist."
      );
    });

    it("throws an error if balance is insufficient", async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ balance: 30 }],
      });

      await expect(decreaseBalance("addr1", 50, mockPool)).rejects.toThrow(
        "Insufficient balance: Address addr1 has only 30 available."
      );
    });
  });
});
