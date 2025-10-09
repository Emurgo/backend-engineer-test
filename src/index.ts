import Fastify from 'fastify';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const fastify = Fastify({ logger: true, maxParamLength: 200 });

fastify.get('/', async (request, reply) => {
  return { hello: 'world' };
});

async function testPostgres(pool: Pool) {
  const id = randomUUID();
  const name = 'Satoshi';
  const email = 'Nakamoto';

  await pool.query(`DELETE FROM users;`);

  await pool.query(
    `
    INSERT INTO users (id, name, email)
    VALUES ($1, $2, $3);
  `,
    [id, name, email]
  );

  const { rows } = await pool.query(`
    SELECT * FROM users;
  `);

  console.log('USERS', rows);
}

async function seedPostgres(pool: Pool) {
  await pool.query(`DELETE FROM balances;`);

  // Seed balances table
  const addresses = [
    'addr1g8krd7ruxm53julk40z6v5frywg4jxl0kj5mc8lu0gja5ek63aevsstjv6pfa2a245e9x0ay2u3egp8wgggtus3n7rryec97grd',
    'addr1quzds8wccl3a8hgr257ztyf9yysv3h82ve42y0j0m5the0ydqnx7guc7429chwy22q4vmaa9ttpkhzz0j6cpkyae42s30yrcmke',
    'addr1r07gfw2rask70wky59qlp6w7nfehny4ujspr8xlsk2te8jtwcsuqmcc56j4dhm7x92rpdlhq050fdzhdpemkn4yw4sgd4ex4uky',
  ];

  // Max 6 decimal places due to lovelace
  const balances = [23534.123426, 2352.191211, 454.002312];

  for (let i = 0; i < addresses.length; i++) {
    await pool.query(
      `
      INSERT INTO balances (address, balance)
      VALUES ($1, $2);
    `,
      [addresses[i], balances[i]]
    );
  }

  console.log('Balances table seeded');
}

async function createTables(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances (
      address TEXT PRIMARY KEY,
      balance NUMERIC(20,6) NOT NULL DEFAULT 0
    );
  `);
}

// GET /balance/:address
fastify.get('/balance/:address', async (request, reply) => {
  const { address } = request.params;

  try {
    const result = await fastify.pool.query(
      `SELECT balance FROM balances WHERE address = $1`,
      [address]
    );

    if (result.rows.length === 0) {
      return reply
        .status(404)
        .send({ error: 'Address not found', address: address });
    }

    return {
      address,
      balance: parseFloat(result.rows[0].balance),
    };
  } catch (error) {
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

async function bootstrap() {
  console.log('Bootstrapping...');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  fastify.decorate('pool', pool);

  await createTables(pool);
  await seedPostgres(pool);
  await testPostgres(pool);
}

try {
  await bootstrap();
  await fastify.listen({
    port: 3000,
    host: '0.0.0.0',
  });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
