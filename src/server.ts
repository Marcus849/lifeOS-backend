import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { config } from "./config.js";
import { registerAuthRoutes } from "./auth.js";
import { registerRoutes } from "./routes.js";
import "./db/database.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: config.corsOrigin });
await app.register(jwt, { secret: config.jwtSecret });
await registerAuthRoutes(app);
await registerRoutes(app);

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
