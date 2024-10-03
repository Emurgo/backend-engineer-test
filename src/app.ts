import Fastify from 'fastify';
import blockRoutes from './routes/blockRoutes';


const fastify = Fastify({ logger: true });

fastify.register(blockRoutes);

export default fastify;

