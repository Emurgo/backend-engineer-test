import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { validateBlock, processBlock } from '../services/blockchain';

export default async function blockRoutes(fastify: FastifyInstance, options: { pool: Pool }) {
  const { pool } = options;

  fastify.post('/blocks', async (request, reply) => {
    const block = request.body;

    try {
      await validateBlock(block, pool);
      await processBlock(block, pool);
      return reply.send({ status: 'Block processed successfully' });
    } catch (err) {
      const error = err as Error;
      return reply.status(400).send({ error: error.message });
    }
  });
}
