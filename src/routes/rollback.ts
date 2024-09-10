import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { rollbackBlocks } from "../services/blockchain";

interface IRollbackQuery {
  height: number;
}

export default async function rollbackRoutes(
  fastify: FastifyInstance,
  options: { pool: Pool }
) {
  const { pool } = options;

  fastify.post("/rollback", async (request, reply) => {
    const { height } = request.query as IRollbackQuery;

    try {
      await rollbackBlocks(height, pool);
      return reply.send({ status: "Rollback successful" });
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });
}
