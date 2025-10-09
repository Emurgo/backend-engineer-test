import { FastifyRequest, FastifyReply } from 'fastify';
import { getBalanceByAddress } from '../services/balanceService';

interface BalanceParams {
  address: string;
}

export async function getBalance(
  request: FastifyRequest<{ Params: BalanceParams }>,
  reply: FastifyReply
) {
  const { address } = request.params;

  try {
    const balance = await getBalanceByAddress(request.server, address);

    if (balance === null) {
      return reply.status(404).send({
        error: 'Address not found',
        address,
      });
    }

    return { address, balance };
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
}
