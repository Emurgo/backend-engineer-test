import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { getBalance } from "../services/balances";

interface IBalanceParams {
  address: string;
}

export default async function balanceRoutes(
  fastify: FastifyInstance,
  options: { pool: Pool }
) {
  const { pool } = options;

  fastify.get("/balance/:address", async (request, reply) => {
    const { address } = request.params as IBalanceParams;
    const balance = await getBalance(address, pool);

    if (balance === null) {
      return reply.status(404).send({ error: "Address not found" });
    }

    return reply.send({ address, balance });
  });
}
