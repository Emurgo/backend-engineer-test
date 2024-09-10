import Fastify from "fastify";
import { Pool } from "pg";
import blockRoutes from "../src/routes/blocks";
import balanceRoutes from "../src/routes/balance";
import rollbackRoutes from "../src/routes/rollback";

const mockPool = {
  query: async () => ({ rows: [] }),
} as unknown as Pool;

const fastify = Fastify();
fastify.register(blockRoutes, { pool: mockPool });
fastify.register(balanceRoutes, { pool: mockPool });
fastify.register(rollbackRoutes, { pool: mockPool });

describe("Fastify routes", () => {
  it("POST /blocks - Valid block", async () => {
    mockPool.query = async (query: any) => {
      if (query.includes("SELECT MAX(height)")) {
        return {
          command: "SELECT",
          rowCount: 1,
          oid: 1,
          rows: [{ max: 1 }],
          fields: [],
        };
      } else if (query.includes("SELECT value FROM outputs")) {
        return {
          command: "SELECT",
          rowCount: 1,
          oid: 1,
          rows: [{ value: 50 }],
          fields: [],
        };
      }
      return {
        command: "SELECT",
        rowCount: 0,
        oid: 1,
        rows: [],
        fields: [],
      };
    };

    const response = await fastify.inject({
      method: "POST",
      url: "/blocks",
      payload: {
        id: "c4701d0bfd7179e1db6e33e947e6c718bbc4a1ae927300cd1e3bda91a930cba5",
        height: 2,
        transactions: [
          {
            id: "tx2",
            inputs: [],
            outputs: [{ address: "addr1", value: 0 }],
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>()).toEqual({
      status: "Block processed successfully",
    });
  });

  it("GET /balance/:address - Valid address", async () => {
    mockPool.query = async (query: any) => {
      if (query.includes("SELECT balance FROM balances")) {
        return {
          command: "SELECT",
          rowCount: 0,
          oid: 1,
          fields: [],
          rows: [{ balance: 100 }],
        };
      }
      return { command: "SELECT", rowCount: 0, oid: 1, fields: [], rows: [] };
    };

    const response = await fastify.inject({
      method: "GET",
      url: "/balance/addr1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ address: string; balance: number }>()).toEqual({
      address: "addr1",
      balance: 100,
    });
  });

  it("POST /rollback?height=2 - Valid rollback", async () => {
    mockPool.query = async (query: any) => {
      if (query.includes("SELECT id FROM blocks WHERE height >")) {
        return {
          command: "SELECT",
          rowCount: 0,
          oid: 1,
          fields: [],
          rows: [{ id: "block3" }],
        };
      }
      return { command: "SELECT", rowCount: 0, oid: 1, fields: [], rows: [] };
    };

    const response = await fastify.inject({
      method: "POST",
      url: "/rollback?height=2",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>()).toEqual({
      status: "Rollback successful",
    });
  });
});
