import Fastify from 'fastify';
import blockRoutes from '../src/routes/blockRoutes';
import * as crypto from 'crypto';

let fastify: any;

beforeAll(async () => {
  fastify = Fastify();
  fastify.register(blockRoutes);
  await fastify.ready();

  // Add a valid block to simulate existing transactions
  const initialBlock = {
    height: 1,
    transactions: [
      {
        id: 'tx1',
        inputs: [],
        outputs: [
          { address: 'address1', value: 100 }, // Adding 100 to address1
        ],
      },
    ],
  };

  // Calculate block ID
  const blockId = crypto.createHash('sha256').update(`${initialBlock.height}${initialBlock.transactions[0].id}`).digest('hex');
  const initialBlockWithId = { id: blockId, ...initialBlock };

  // Add the initial block
  await fastify.inject({
    method: 'POST',
    url: '/v1/blocks',
    payload: initialBlockWithId,
  });
});

afterAll(async () => {
  await fastify.close();
});

describe('GET /v1/balance/:address', () => {
  it('should return the balance for an existing address', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/balance/address1',
    });

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.balance).toBe(100); 
    expect(responseBody.address).toBe('address1');
  });

  it('should return 404 for an address that does not exist in any transaction', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/balance/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  
  }); 
});
