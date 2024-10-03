
import Fastify from 'fastify';
import blockRoutes from '../src/routes/blockRoutes';
import * as crypto from 'crypto';
import { FastifyInstance } from 'fastify';

// function to calculate block ID
const calculateBlockId = (block: { height: number; transactions: { id: string }[] }): string => {
  const txIds = block.transactions.map(tx => tx.id).join('');
  const blockString = `${block.height}${txIds}`;
  return crypto.createHash('sha256').update(blockString).digest('hex');
};
let fastify: FastifyInstance;

beforeAll(async () => {
  // Initialize Fastify instance
  fastify = Fastify();
  fastify.register(blockRoutes);

  await fastify.ready();
});

afterAll(async () => {
  await fastify.close();
});

describe('POST /v1/blocks', () => {
  it('should successfully add a block with valid data', async () => {
    const validBlock = {
      height: 1,
      transactions: [
        {
          id: 'tx1',
          inputs: [],
          outputs: [
            { address: 'address1', value: 50 },
          ],
        },
      ],
    };

    // Calculate block ID
    const blockId = calculateBlockId(validBlock);
    const validBlockWithId = { id: blockId, ...validBlock };

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/blocks',
      payload: validBlockWithId,
    });

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.message).toBe('Block added successfully');
    expect(responseBody.block).toBeDefined();
    expect(responseBody.block.id).toBe(validBlockWithId.id);
  });

  it('should return 400 for duplicate block ID', async () => {
    const validBlock = {
      height: 1,
      transactions: [
        {
          id: 'tx1',
          inputs: [],
          outputs: [
            { address: 'address1', value: 50 },
          ],
        },
      ],
    };
  
    const blockId = crypto.createHash('sha256').update(`${validBlock.height}${validBlock.transactions[0].id}`).digest('hex');
    const validBlockWithId = { id: blockId, ...validBlock };
  
    // Send the first request to add the block
    await fastify.inject({
      method: 'POST',
      url: '/v1/blocks',
      payload: validBlockWithId,
    });
  
    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/blocks',
      payload: validBlockWithId,
    });
  
    // Validate that the error message is for the duplicate block ID
    expect(response.statusCode).toBe(400);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('Block with the same ID has already been processed');
  });
  it('should return 400 for invalid block height', async () => {
    const invalidHeightBlock = {
      height: 3,
      transactions: [
        {
          id: 'tx3',
          inputs: [],
          outputs: [
            { address: 'address3', value: 20 },
          ],
        },
      ],
    };

    const blockId = calculateBlockId(invalidHeightBlock);
    const invalidBlockWithId = { id: blockId, ...invalidHeightBlock };

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/blocks',
      payload: invalidBlockWithId,
    });

    expect(response.statusCode).toBe(400);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('Invalid block height');
  });

  it('should return 400 if inputs and outputs do not match', async () => {
    const invalidSumBlock = {
      height: 2,
      transactions: [
        {
          id: 'tx4',
          inputs: [
            { txId: 'tx1', index: 0 },
          ],
          outputs: [
            { address: 'address4', value: 100 },
          ],
        },
      ],
    };

    const blockId = calculateBlockId(invalidSumBlock);
    const invalidSumBlockWithId = { id: blockId, ...invalidSumBlock };

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/blocks',
      payload: invalidSumBlockWithId,
    });

    expect(response.statusCode).toBe(400);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.error).toBe('Input and output sums do not match');
  });
});
