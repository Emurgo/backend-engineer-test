import { FastifyInstance } from 'fastify';

export async function getBalanceByAddress(
  fastify: FastifyInstance,
  address: string
): Promise<number | null> {
  const result = await fastify.pool.query(
    `SELECT balance FROM balances WHERE address = $1`,
    [address]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return parseFloat(result.rows[0].balance);
}
