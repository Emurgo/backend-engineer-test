import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BlockDTO, validateBlockDTO } from '../models/block.dto';
import * as crypto from 'crypto';
import { Block, Transaction } from '../models/block';

export let blockchain: Block[] = [];
export let addressBalances: { [key: string]: number } = {};

// Register routes for Fastify
async function blockRoutes(fastify: FastifyInstance) {

  // POST /v1/blocks - Add a block to the blockchain
  fastify.post<{ Body: BlockDTO }>('/v1/blocks', async (request, reply) => {
    try {
      const blockDTO = request.body;
      console.log('Received block DTO:', blockDTO);

      // Validate the BlockDTO using the validation function
      const validationError = validateBlockDTO(blockDTO);
      if (validationError) {
        console.log('Validation error:', validationError);
        return reply.status(400).send({ error: validationError });
      }

      // Check if block with the same ID has already been processed
      const existingBlock = blockchain.find(b => b.id === blockDTO.id);
      if (existingBlock) {
        console.log('Duplicate block ID:', blockDTO.id);
        return reply.status(400).send({ error: 'Block with the same ID has already been processed' });
      }

      // Check block contains atleast one transaction
      if (!blockDTO.transactions || blockDTO.transactions.length === 0) {
        console.log('Empty transactions in block');
        return reply.status(400).send({ error: 'Block must contain at least one transaction' });
      }

      // Validate block height
      const expectedHeight = blockchain.length ? blockchain[blockchain.length - 1].height + 1 : 1;
      if (blockDTO.height !== expectedHeight) {
        console.log('Invalid block height:', blockDTO.height, 'Expected:', expectedHeight);
        return reply.status(400).send({ error: 'Invalid block height' });
      }

      // Validate block ID by calculating the SHA-256 hash
      const calculatedId = calculateBlockId(blockDTO.height, blockDTO.transactions);
      console.log(`calculatedId : ${calculatedId}`);
      console.log(` block ID: ${calculatedId}, Provided block ID: ${blockDTO.id}`);
      if (calculatedId !== blockDTO.id) {
        console.log(`Block ID mismatch: expected ${calculatedId}, received ${blockDTO.id}`);
        return reply.status(400).send({ error: 'Invalid block ID' });
      }

      // Converting BlockDTO to internal Block model
      const block: Block = {
        id: blockDTO.id,
        height: blockDTO.height,
        transactions: blockDTO.transactions.map(tx => ({
          id: tx.id,
          inputs: tx.inputs,
          outputs: tx.outputs,
        })),
      };

      // Validate the sum of inputs and outputs for all transactions
      for (const tx of block.transactions) {
        const inputSum = sumTransactionInputs(tx);
        const outputSum = sumTransactionOutputs(tx);

        // Allow transactions (no inputs) for the first block
        if (inputSum === 0 && blockchain.length === 0) {
          continue;
        }

        if (inputSum !== outputSum) {
          console.log(`Input/output sum mismatch for transaction ${tx.id}: Inputs ${inputSum}, Outputs ${outputSum}`);
          return reply.status(400).send({ error: 'Input and output sums do not match' });
        }
      }

      blockchain.push(block);
      console.log('Block added successfully:', block);

      recalculateBalances();
      logAddressBalances();

      return reply.status(200).send({ message: 'Block added successfully', block });
    } catch (error) {
      console.error('Error while processing block:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /balance/:address - Fetch balance of a specific address
  fastify.get<{ Params: { address: string } }>('/v1/balance/:address', async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    const { address } = request.params;
    console.log('Current blockchain height:', blockchain.length ? blockchain[blockchain.length - 1].height : 0);

    const balance = calculateBalance(address);

    // If address not found in transactions, return 404
    if (balance === undefined) {
      return reply.status(404).send({ error: `Address ${address} not found` });
    }

    return reply.status(200).send({ address, balance });
  });

  // POST /rollback?height=number - Rollback the blockchain to a specific height
  fastify.post<{ Querystring: { height: number } }>('/v1/rollback', async (request: FastifyRequest<{ Querystring: { height: number } }>, reply: FastifyReply) => {
    const { height } = request.query;

    const currentHeight = blockchain.length ? blockchain[blockchain.length - 1].height : 0;
    console.log('Current blockchain height:', currentHeight);
    if (height >= currentHeight) {
      return reply.status(400).send({ error: `Invalid rollback height. The current height is ${currentHeight}` });
    }

    if (height < 0) {
      return reply.status(400).send({ error: 'Rollback height must be greater than or equal to 0' });
    }

    // Perform rollback by removing blocks after the specified height
    blockchain = blockchain.filter(block => block.height <= height);

    // Recalculate address balances from the remaining blocks
    recalculateBalances();

    return reply.status(200).send({ message: `Blockchain rolled back to height ${height}` });
  });
}

// Helper functions List
// Helper function to recalculate address balances
const recalculateBalances = () => {
  // Reset balances
  addressBalances = {};

  // Reprocess all transactions from the current blockchain
  for (const block of blockchain) {
    for (const tx of block.transactions) {
      processTransaction(tx);
    }
  }
};

// Helper function to calculate balance for an address
const calculateBalance = (address: string): number | undefined => {
  if (!(address in addressBalances)) {
    return undefined;
  }
  return addressBalances[address];
};

// Helper functions to sum transaction inputs and outputs
const sumTransactionInputs = (tx: Transaction): number => {
  let total = 0;
  for (const input of tx.inputs) {
    const prevTx = findTransactionById(input.txId);
    if (prevTx) {
      total += prevTx.outputs[input.index].value;
    }
  }
  return total;
};

const sumTransactionOutputs = (tx: Transaction): number => {
  return tx.outputs.reduce((sum, output) => sum + output.value, 0);
};

// Process transactions to update address balances
const processTransaction = (tx: Transaction) => {
  // Removes from inputs
  for (const input of tx.inputs) {
    const prevTx = findTransactionById(input.txId);
    if (prevTx) {
      const prevOutput = prevTx.outputs[input.index];

      // Initialize the balance for the input address if it doesn't exist
      if (!(prevOutput.address in addressBalances)) {
        addressBalances[prevOutput.address] = 0;
      }

      // Prevent negative balance
      if (addressBalances[prevOutput.address] < prevOutput.value) {
        throw new Error(`Insufficient balance for address ${prevOutput.address}`);
      }

      // Deduct the value from the input address
      addressBalances[prevOutput.address] -= prevOutput.value;
      console.log(`Deducted ${prevOutput.value} from ${prevOutput.address}. New balance: ${addressBalances[prevOutput.address]}`);
    }
  }

  // Add to outputs
  for (const output of tx.outputs) {
    if (!(output.address in addressBalances)) {
      addressBalances[output.address] = 0;
    }

    addressBalances[output.address] += output.value;
    console.log(`Added ${output.value} to ${output.address}. New balance: ${addressBalances[output.address]}`);
  }
};

// Helper function to find a transaction by its ID
const findTransactionById = (txId: string): Transaction | undefined => {
  for (const block of blockchain) {
    const transaction = block.transactions.find(tx => tx.id === txId);
    if (transaction) {
      console.log(`Found transaction ${txId}`);
      return transaction;
    }
  }
  console.log(`Transaction ${txId} not found`);
  return undefined;
};

// Helper function to log current address balances
const logAddressBalances = () => {
  console.log("Current Address Balances: ");
  console.log(addressBalances);
};

// Helper function to calculate block ID based on height and transaction IDs
const calculateBlockId = (height: number, transactions: Transaction[]): string => {
  const txIds = transactions.map(tx => tx.id).join('');
  const blockString = `${height}${txIds}`;
  return crypto.createHash('sha256').update(blockString).digest('hex');
};

export default blockRoutes;
