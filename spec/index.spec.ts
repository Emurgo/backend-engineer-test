import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { createHash } from "crypto";
import { Pool } from "pg";
import type { Block, Transaction } from "../src/types";

// Test configuration
const TEST_DATABASE_URL = process.env.DATABASE_URL || "postgres://myuser:mypassword@localhost:5432/mydatabase";
const API_URL = "http://localhost:3000";

let pool: Pool;

// Helper function to calculate block hash
function calculateBlockHash(block: Block): string {
  const data = block.height + block.transactions.map(tx => tx.id).join('');
  return createHash('sha256').update(data).digest('hex');
}

// Helper function to create a valid block
function createBlock(height: number, transactions: Transaction[]): Block {
  const block = {
    id: '',
    height,
    transactions
  };
  block.id = calculateBlockHash(block);
  return block;
}

// Clean database before tests
async function cleanDatabase() {
  await pool.query('DELETE FROM outputs');
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM blocks');
}

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DATABASE_URL });
  // Wait for API to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await cleanDatabase();
});

describe('POST /blocks', () => {
  test('should accept a valid first block (height 1) with coinbase transaction', async () => {
    const block = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);

    const response = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block)
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.height).toBe(1);
  });

  test('should reject block with incorrect height', async () => {
    const block = createBlock(5, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);

    const response = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid height');
  });

  test('should reject block with invalid hash', async () => {
    const block = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);
    block.id = 'invalid_hash';

    const response = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid block ID');
  });

  test('should reject transaction with mismatched input/output sums', async () => {
    // First, add a valid block
    const block1 = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block1)
    });

    // Try to spend 10 but output 15
    const block2 = createBlock(2, [{
      id: 'tx2',
      inputs: [{ txId: 'tx1', index: 0 }],
      outputs: [{ address: 'addr2', value: 15 }]
    }]);

    const response = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block2)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('mismatched input/output sums');
  });

  test('should reject transaction referencing non-existent output', async () => {
    const block = createBlock(1, [{
      id: 'tx1',
      inputs: [{ txId: 'nonexistent', index: 0 }],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);

    const response = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('non-existent output');
  });

  test('should reject transaction spending already spent output', async () => {
    // Block 1: coinbase
    const block1 = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block1)
    });

    // Block 2: spend tx1 output
    const block2 = createBlock(2, [{
      id: 'tx2',
      inputs: [{ txId: 'tx1', index: 0 }],
      outputs: [{ address: 'addr2', value: 10 }]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block2)
    });

    // Block 3: try to spend tx1 output again (double spend)
    const block3 = createBlock(3, [{
      id: 'tx3',
      inputs: [{ txId: 'tx1', index: 0 }],
      outputs: [{ address: 'addr3', value: 10 }]
    }]);

    const response = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block3)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('already spent');
  });

  test('should process valid sequential blocks correctly', async () => {
    // Block 1
    const block1 = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);
    const res1 = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block1)
    });
    expect(res1.status).toBe(200);

    // Block 2
    const block2 = createBlock(2, [{
      id: 'tx2',
      inputs: [{ txId: 'tx1', index: 0 }],
      outputs: [
        { address: 'addr2', value: 4 },
        { address: 'addr3', value: 6 }
      ]
    }]);
    const res2 = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block2)
    });
    expect(res2.status).toBe(200);
  });
});

describe('GET /balance/:address', () => {
  test('should return 0 for address with no transactions', async () => {
    const response = await fetch(`${API_URL}/balance/addr_unknown`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.balance).toBe(0);
  });

  test('should return correct balance after receiving funds', async () => {
    // Add block with coinbase
    const block = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block)
    });

    const response = await fetch(`${API_URL}/balance/addr1`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.address).toBe('addr1');
    expect(data.balance).toBe(10);
  });

  test('should return correct balance after spending funds', async () => {
    // Block 1: addr1 receives 10
    const block1 = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block1)
    });

    // Block 2: addr1 spends 10, addr2 and addr3 receive
    const block2 = createBlock(2, [{
      id: 'tx2',
      inputs: [{ txId: 'tx1', index: 0 }],
      outputs: [
        { address: 'addr2', value: 4 },
        { address: 'addr3', value: 6 }
      ]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block2)
    });

    // Check balances
    const res1 = await fetch(`${API_URL}/balance/addr1`);
    const data1 = await res1.json();
    expect(data1.balance).toBe(0);

    const res2 = await fetch(`${API_URL}/balance/addr2`);
    const data2 = await res2.json();
    expect(data2.balance).toBe(4);

    const res3 = await fetch(`${API_URL}/balance/addr3`);
    const data3 = await res3.json();
    expect(data3.balance).toBe(6);
  });

  test('should handle complex transaction scenario from README example', async () => {
    // Block 1
    const block1 = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block1)
    });

    // Block 2
    const block2 = createBlock(2, [{
      id: 'tx2',
      inputs: [{ txId: 'tx1', index: 0 }],
      outputs: [
        { address: 'addr2', value: 4 },
        { address: 'addr3', value: 6 }
      ]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block2)
    });

    // Block 3
    const block3 = createBlock(3, [{
      id: 'tx3',
      inputs: [{ txId: 'tx2', index: 1 }],
      outputs: [
        { address: 'addr4', value: 2 },
        { address: 'addr5', value: 2 },
        { address: 'addr6', value: 2 }
      ]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block3)
    });

    // Verify final balances
    const checks = [
      { addr: 'addr1', expected: 0 },
      { addr: 'addr2', expected: 4 },
      { addr: 'addr3', expected: 0 },
      { addr: 'addr4', expected: 2 },
      { addr: 'addr5', expected: 2 },
      { addr: 'addr6', expected: 2 }
    ];

    for (const check of checks) {
      const response = await fetch(`${API_URL}/balance/${check.addr}`);
      const data = await response.json();
      expect(data.balance).toBe(check.expected);
    }
  });
});

describe('POST /rollback', () => {
  test('should rollback to specified height', async () => {
    // Add 3 blocks
    const block1 = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block1)
    });

    const block2 = createBlock(2, [{
      id: 'tx2',
      inputs: [{ txId: 'tx1', index: 0 }],
      outputs: [
        { address: 'addr2', value: 4 },
        { address: 'addr3', value: 6 }
      ]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block2)
    });

    const block3 = createBlock(3, [{
      id: 'tx3',
      inputs: [{ txId: 'tx2', index: 1 }],
      outputs: [
        { address: 'addr4', value: 2 },
        { address: 'addr5', value: 4 }
      ]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block3)
    });

    // Rollback to height 2
    const response = await fetch(`${API_URL}/rollback?height=2`, {
      method: 'POST'
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.height).toBe(2);

    // Verify balances after rollback
    const res1 = await fetch(`${API_URL}/balance/addr1`);
    const data1 = await res1.json();
    expect(data1.balance).toBe(0);

    const res2 = await fetch(`${API_URL}/balance/addr2`);
    const data2 = await res2.json();
    expect(data2.balance).toBe(4);

    const res3 = await fetch(`${API_URL}/balance/addr3`);
    const data3 = await res3.json();
    expect(data3.balance).toBe(6);

    // addr4 and addr5 should have 0 balance
    const res4 = await fetch(`${API_URL}/balance/addr4`);
    const data4 = await res4.json();
    expect(data4.balance).toBe(0);
  });

  test('should allow adding new block after rollback', async () => {
    // Add 2 blocks
    const block1 = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block1)
    });

    const block2 = createBlock(2, [{
      id: 'tx2',
      inputs: [{ txId: 'tx1', index: 0 }],
      outputs: [{ address: 'addr2', value: 10 }]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block2)
    });

    // Rollback to height 1
    await fetch(`${API_URL}/rollback?height=1`, {
      method: 'POST'
    });

    // Add new block at height 2
    const newBlock2 = createBlock(2, [{
      id: 'tx2_new',
      inputs: [{ txId: 'tx1', index: 0 }],
      outputs: [{ address: 'addr3', value: 10 }]
    }]);
    const response = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBlock2)
    });
    expect(response.status).toBe(200);

    // Verify addr3 has balance, addr2 doesn't
    const res2 = await fetch(`${API_URL}/balance/addr2`);
    const data2 = await res2.json();
    expect(data2.balance).toBe(0);

    const res3 = await fetch(`${API_URL}/balance/addr3`);
    const data3 = await res3.json();
    expect(data3.balance).toBe(10);
  });

  test('should reject rollback with invalid height parameter', async () => {
    const response = await fetch(`${API_URL}/rollback?height=invalid`, {
      method: 'POST'
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid height parameter');
  });

  test('should handle rollback to height 0', async () => {
    // Add a block
    const block1 = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [{ address: 'addr1', value: 10 }]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block1)
    });

    // Rollback to height 0 (genesis)
    const response = await fetch(`${API_URL}/rollback?height=0`, {
      method: 'POST'
    });
    expect(response.status).toBe(200);

    // Verify all balances are 0
    const res = await fetch(`${API_URL}/balance/addr1`);
    const data = await res.json();
    expect(data.balance).toBe(0);
  });
});

describe('Edge cases', () => {
  test('should handle multiple outputs to same address', async () => {
    const block = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [
        { address: 'addr1', value: 5 },
        { address: 'addr1', value: 3 },
        { address: 'addr1', value: 2 }
      ]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block)
    });

    const response = await fetch(`${API_URL}/balance/addr1`);
    const data = await response.json();
    expect(data.balance).toBe(10);
  });

  test('should handle transaction with multiple inputs', async () => {
    // Block 1: create multiple outputs
    const block1 = createBlock(1, [{
      id: 'tx1',
      inputs: [],
      outputs: [
        { address: 'addr1', value: 5 },
        { address: 'addr1', value: 3 }
      ]
    }]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block1)
    });

    // Block 2: spend both outputs
    const block2 = createBlock(2, [{
      id: 'tx2',
      inputs: [
        { txId: 'tx1', index: 0 },
        { txId: 'tx1', index: 1 }
      ],
      outputs: [{ address: 'addr2', value: 8 }]
    }]);
    const response = await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block2)
    });
    expect(response.status).toBe(200);

    const res1 = await fetch(`${API_URL}/balance/addr1`);
    const data1 = await res1.json();
    expect(data1.balance).toBe(0);

    const res2 = await fetch(`${API_URL}/balance/addr2`);
    const data2 = await res2.json();
    expect(data2.balance).toBe(8);
  });

  test('should handle block with multiple transactions', async () => {
    const block = createBlock(1, [
      {
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      },
      {
        id: 'tx2',
        inputs: [],
        outputs: [{ address: 'addr2', value: 5 }]
      }
    ]);
    await fetch(`${API_URL}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block)
    });

    const res1 = await fetch(`${API_URL}/balance/addr1`);
    const data1 = await res1.json();
    expect(data1.balance).toBe(10);

    const res2 = await fetch(`${API_URL}/balance/addr2`);
    const data2 = await res2.json();
    expect(data2.balance).toBe(5);
  });
});