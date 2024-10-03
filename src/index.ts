import Fastify from 'fastify';
import blockRoutes from './routes/blockRoutes';

const fastify = Fastify({ logger: true });

// Main bootstrap function to set up the Fastify server
async function bootstrap() {
  try {
    console.log('Bootstrapping...');

    // Register block routes
    fastify.register(blockRoutes);

    // Start the Fastify server
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server is listening on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
