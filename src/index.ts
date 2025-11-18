import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import type { Block, Transaction, Input, Output } from './types';

const fastify = Fastify({ logger: true });
let pool: Pool;

// Database schema creation
async function createTables(dbPool: Pool) {
  // Store blocks
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      height INTEGER UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Store transactions
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE
    );
  `);

  // Store outputs (UTXOs)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS outputs (
      tx_id TEXT NOT NULL,
      output_index INTEGER NOT NULL,
      address TEXT NOT NULL,
      value NUMERIC NOT NULL,
      spent BOOLEAN DEFAULT FALSE,
      PRIMARY KEY (tx_id, output_index),
      FOREIGN KEY (tx_id) REFERENCES transactions(id) ON DELETE CASCADE
    );
  `);

  // Store inputs (references to outputs being spent)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS inputs (
      tx_id TEXT NOT NULL,
      input_index INTEGER NOT NULL,
      spent_tx_id TEXT NOT NULL,
      spent_output_index INTEGER NOT NULL,
      PRIMARY KEY (tx_id, input_index),
      FOREIGN KEY (tx_id) REFERENCES transactions(id) ON DELETE CASCADE
    );
  `);

  // Create index for faster lookups
  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_address ON outputs(address);
  `);
  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_spent ON outputs(spent);
  `);
}

// Get current blockchain height
async function getCurrentHeight(): Promise<number> {
  const result = await pool.query(`
    SELECT COALESCE(MAX(height), 0) as height FROM blocks;
  `);
  return parseInt(result.rows[0].height);
}

// Calculate block hash
function calculateBlockHash(block: Block): string {
  const data = block.height + block.transactions.map(tx => tx.id).join('');
  return createHash('sha256').update(data).digest('hex');
}

// Validate block
async function validateBlock(block: Block): Promise<{ valid: boolean; error?: string }> {
  const currentHeight = await getCurrentHeight();
  
  // Validate height
  if (block.height !== currentHeight + 1) {
    return {
      valid: false,
      error: `Invalid height. Expected ${currentHeight + 1}, got ${block.height}`
    };
  }

  // Validate block ID
  const expectedHash = calculateBlockHash(block);
  if (block.id !== expectedHash) {
    return {
      valid: false,
      error: `Invalid block ID. Expected ${expectedHash}, got ${block.id}`
    };
  }

  // Validate each transaction's inputs/outputs balance
  for (const tx of block.transactions) {
    let inputSum = 0;
    let outputSum = 0;

    // Calculate input sum by looking up previous outputs
    for (const input of tx.inputs) {
      const result = await pool.query(
        `SELECT value, spent FROM outputs WHERE tx_id = $1 AND output_index = $2`,
        [input.txId, input.index]
      );

      if (result.rows.length === 0) {
        return {
          valid: false,
          error: `Input references non-existent output: txId=${input.txId}, index=${input.index}`
        };
      }

      if (result.rows[0].spent) {
        return {
          valid: false,
          error: `Input references already spent output: txId=${input.txId}, index=${input.index}`
        };
      }

      inputSum += parseFloat(result.rows[0].value);
    }

    // Calculate output sum
    outputSum = tx.outputs.reduce((sum, output) => sum + output.value, 0);

    // Validate input sum equals output sum (skip for coinbase transactions with no inputs)
    if (tx.inputs.length > 0 && inputSum !== outputSum) {
      return {
        valid: false,
        error: `Transaction ${tx.id} has mismatched input/output sums. Inputs: ${inputSum}, Outputs: ${outputSum}`
      };
    }
  }

  return { valid: true };
}

// Process and store a block
async function processBlock(block: Block): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert block
    await client.query(
      `INSERT INTO blocks (id, height) VALUES ($1, $2)`,
      [block.id, block.height]
    );

    // Process each transaction
    for (const tx of block.transactions) {
      // Insert transaction
      await client.query(
        `INSERT INTO transactions (id, block_id) VALUES ($1, $2)`,
        [tx.id, block.id]
      );

      // Store inputs and mark referenced outputs as spent
      for (let i = 0; i < tx.inputs.length; i++) {
        const input = tx.inputs[i];
        
        // Store the input reference
        await client.query(
          `INSERT INTO inputs (tx_id, input_index, spent_tx_id, spent_output_index) VALUES ($1, $2, $3, $4)`,
          [tx.id, i, input.txId, input.index]
        );
        
        // Mark the output as spent
        await client.query(
          `UPDATE outputs SET spent = TRUE WHERE tx_id = $1 AND output_index = $2`,
          [input.txId, input.index]
        );
      }

      // Insert outputs
      for (let i = 0; i < tx.outputs.length; i++) {
        const output = tx.outputs[i];
        await client.query(
          `INSERT INTO outputs (tx_id, output_index, address, value, spent) VALUES ($1, $2, $3, $4, FALSE)`,
          [tx.id, i, output.address, output.value]
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Get balance for an address
async function getBalance(address: string): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(value), 0) as balance 
     FROM outputs 
     WHERE address = $1 AND spent = FALSE`,
    [address]
  );
  return parseFloat(result.rows[0].balance);
}

// Rollback to a specific height
async function rollbackToHeight(targetHeight: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current height
    const currentHeight = await getCurrentHeight();
    
    if (targetHeight > currentHeight) {
      throw new Error(`Cannot rollback to height ${targetHeight}, current height is ${currentHeight}`);
    }

    if (targetHeight < 0) {
      throw new Error(`Invalid target height: ${targetHeight}`);
    }

    // Before deleting blocks, restore the spent status of outputs that were consumed by
    // transactions in blocks we're about to delete
    await client.query(`
      UPDATE outputs SET spent = FALSE
      WHERE (tx_id, output_index) IN (
        SELECT i.spent_tx_id, i.spent_output_index
        FROM inputs i
        JOIN transactions t ON i.tx_id = t.id
        JOIN blocks b ON t.block_id = b.id
        WHERE b.height > $1
      )
    `, [targetHeight]);

    // Delete blocks higher than target height
    // Cascade will handle: transactions -> inputs and outputs
    await client.query(
      `DELETE FROM blocks WHERE height > $1`,
      [targetHeight]
    );
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Routes
fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
  return { hello: 'world' };
});

fastify.post<{ Body: Block }>('/blocks', async (request: FastifyRequest<{ Body: Block }>, reply: FastifyReply) => {
  try {
    const block = request.body;

    // Validate block structure
    if (!block || !block.id || typeof block.height !== 'number' || !Array.isArray(block.transactions)) {
      return reply.status(400).send({ error: 'Invalid block structure' });
    }

    // Validate block
    const validation = await validateBlock(block);
    if (!validation.valid) {
      return reply.status(400).send({ error: validation.error });
    }

    // Process block
    await processBlock(block);

    return reply.status(200).send({ success: true, height: block.height });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

fastify.get<{ Params: { address: string } }>('/balance/:address', async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
  try {
    const { address } = request.params;
    const balance = await getBalance(address);
    return reply.status(200).send({ address, balance });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

fastify.post<{ Querystring: { height: string } }>('/rollback', async (request: FastifyRequest<{ Querystring: { height: string } }>, reply: FastifyReply) => {
  try {
    const height = parseInt(request.query.height);
    
    if (isNaN(height)) {
      return reply.status(400).send({ error: 'Invalid height parameter' });
    }

    await rollbackToHeight(height);
    return reply.status(200).send({ success: true, height });
  } catch (error) {
    fastify.log.error(error);
    if (error instanceof Error) {
      return reply.status(400).send({ error: error.message });
    }
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// Bootstrap function
async function bootstrap() {
  console.log('Bootstrapping...');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  pool = new Pool({
    connectionString: databaseUrl
  });

  await createTables(pool);
  console.log('Database tables created successfully');
}

// Start server
try {
  await bootstrap();
  await fastify.listen({
    port: 3000,
    host: '0.0.0.0'
  });
  console.log('Server listening on port 3000');
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

// Export for testing
export { fastify, pool, getBalance, getCurrentHeight, calculateBlockHash };