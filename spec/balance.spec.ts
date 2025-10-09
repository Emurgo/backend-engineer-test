import { test, expect } from 'bun:test';

const url = 'http://localhost:3000/balance';

test('test GET /balance/:address API with seeded data', async () => {
  const seededBalance = {
    address:
      'addr1g8krd7ruxm53julk40z6v5frywg4jxl0kj5mc8lu0gja5ek63aevsstjv6pfa2a245e9x0ay2u3egp8wgggtus3n7rryec97grd',
    balance: 23534.123426,
  };
  const response = await fetch(`${url}/${seededBalance.address}`);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data).toBeDefined();
  expect(data.address).toBe(seededBalance.address);
  expect(data.balance).toBe(seededBalance.balance);
});

test('test GET /balance/:address API with unfound address', async () => {
  const invalidAddress =
    'addr1g8krd7ruxm53julk40z6v5frywg4jxl0kj5mc8lu0gja5ek63aevsstjv6pfa2a245e9x0ay2u3egp8wgggtus3n7rryec97gry';
  const response = await fetch(`${url}/${invalidAddress}`);
  const data = await response.json();

  expect(response.status).toBe(404);
  expect(data.error).toBe('Address not found');
});
