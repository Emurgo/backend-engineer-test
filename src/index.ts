import { Pool } from 'pg';
import { createApp } from './app';
import { runMigrations } from './db/migrations';
import { runSeeds } from './db/seeds';

async function bootstrap() {
  console.log('Bootstrapping...');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });
  const app = createApp(pool);

  if (await needsInitSetup(pool)) {
    console.log('⏳ Setting up database...');
    await runMigrations(pool);
    await runSeeds(pool);
    console.log('⌛️ Database setup completed');
  } else {
    console.log('✅ Database already set up');
  }

  await app.listen({
    port: 3000,
    host: '0.0.0.0',
  });
}

async function needsInitSetup(pool: Pool): Promise<boolean> {
  const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'balances'
      );
    `);
  return !result.rows[0].exists;
}

try {
  await bootstrap();
  console.log('🚀 app is ready');
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
