import Fastify from "fastify";
import { createPool } from "./db";
import blockRoutes from "./routes/blocks";
import balanceRoutes from "./routes/balance";
import rollbackRoutes from "./routes/rollback";

const fastify = Fastify({ logger: true });

async function bootstrap() {
  const pool = await createPool();

  fastify.register(blockRoutes, { pool });
  fastify.register(balanceRoutes, { pool });
  fastify.register(rollbackRoutes, { pool });

  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server started at http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
