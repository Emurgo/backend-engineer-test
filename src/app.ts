import Fastify from 'fastify';
import { Pool } from 'pg';
import balanceRoutes from './routes/balance';

export function createApp(pool: Pool) {
  const fastify = Fastify({
    logger: true,
    maxParamLength: 200,
  });

  fastify.decorate('pool', pool);

  // Routes
  fastify.register(balanceRoutes, { prefix: '/api' });

  return fastify;
}
