import { FastifyInstance } from 'fastify';
import { getBalance } from '../controllers/balanceController'; // Import the function

export default async function balanceRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/balance/:address',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              balance: { type: 'number' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              address: { type: 'string' },
            },
          },
          500: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    getBalance
  );
}
