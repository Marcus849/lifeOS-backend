import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db/database.js";
import type { AuthenticatedRequest } from "./types.js";

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
});

function publicUser(user: { id: number; username: string; email: string; account_status: string }) {
  return { id: user.id, username: user.username, email: user.email, accountStatus: user.account_status };
}

function issueToken(app: FastifyInstance, user: { id: number; email: string }) {
  return app.jwt.sign({ userId: user.id, email: user.email });
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request, reply) => {
    const parsed = credentials.safeParse(request.body);
    if (!parsed.success || !parsed.data.username) return reply.code(400).send({ error: "username, email and an 8-character password are required" });
    const { email, password, username } = parsed.data;
    const existing = db.prepare("SELECT id FROM users WHERE email = ? OR username = ?").get(email.toLowerCase(), username);
    if (existing) return reply.code(409).send({ error: "An account with that email or username already exists" });
    const result = db.transaction(() => {
      const userResult = db.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)").run(username, email.toLowerCase(), bcrypt.hashSync(password, 12));
      const userId = Number(userResult.lastInsertRowid);
      db.prepare("INSERT INTO profiles (user_id, display_name) VALUES (?, ?)").run(userId, username);
      db.prepare("INSERT INTO player_progress (user_id) VALUES (?)").run(userId);
      db.prepare("INSERT INTO player_wallet (user_id) VALUES (?)").run(userId);
      db.prepare("INSERT INTO user_stats (user_id) VALUES (?)").run(userId);
      db.prepare("INSERT INTO player_resources (user_id) VALUES (?)").run(userId);
      return db.prepare("SELECT id, username, email, account_status FROM users WHERE id = ?").get(userId) as { id: number; username: string; email: string; account_status: string };
    })();
    return reply.code(201).send({ user: publicUser(result), token: issueToken(app, result) });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = credentials.pick({ email: true, password: true }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "valid email and password are required" });
    const user = db.prepare("SELECT id, username, email, password_hash, account_status FROM users WHERE email = ?").get(parsed.data.email.toLowerCase()) as ({ id: number; username: string; email: string; password_hash: string; account_status: string } | undefined);
    if (!user || !bcrypt.compareSync(parsed.data.password, user.password_hash)) return reply.code(401).send({ error: "invalid email or password" });
    return { user: publicUser(user), token: issueToken(app, user) };
  });

  app.get("/api/auth/me", { preHandler: authenticate }, async (request) => {
    const authRequest = request as AuthenticatedRequest;
    const user = db.prepare("SELECT id, username, email, account_status FROM users WHERE id = ?").get(authRequest.user.userId) as { id: number; username: string; email: string; account_status: string };
    return { user: publicUser(user) };
  });
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "authentication required" });
  }
}
