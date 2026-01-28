/**
 * Outbox relay: polls core-service outbox, publishes envelopes to Redis (realtime:events).
 * Run as a separate process alongside core-service. Env: DATABASE_URL, REDIS_URL, REDIS_CHANNEL.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import Redis from "ioredis";
import { PrismaClient } from "../generated/prisma/client";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const REDIS_URL = process.env.REDIS_URL ?? "";
const REDIS_CHANNEL = process.env.REDIS_CHANNEL ?? "realtime:events";
const POLL_MS = Number(process.env.RELAY_POLL_MS) || 500;
const BATCH_SIZE = Number(process.env.RELAY_BATCH_SIZE) || 100;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!REDIS_URL) {
  console.error("REDIS_URL is required");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

// Prevent unhandled ioredis error events (e.g. when Redis is down or REDIS_URL is wrong)
let lastRedisErrorLog = 0;
redis.on("error", (err: Error) => {
  const now = Date.now();
  if (now - lastRedisErrorLog >= 5000) {
    console.error("[relay] Redis error (is Redis running? check REDIS_URL):", err.message);
    lastRedisErrorLog = now;
  }
});

async function runBatch(): Promise<number> {
  const rows = await prisma.outboxEvent.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE
  });
  if (rows.length === 0) return 0;

  for (const row of rows) {
    const envelope = row.envelope as object;
    const payload = JSON.stringify(envelope);
    await redis.publish(REDIS_CHANNEL, payload);
    await prisma.outboxEvent.update({
      where: { id: row.id },
      data: { status: "PUBLISHED", publishedAt: new Date() }
    });
  }
  return rows.length;
}

async function loop(): Promise<never> {
  await prisma.$connect();
  console.log(`[relay] started; channel=${REDIS_CHANNEL} poll_ms=${POLL_MS}`);
  for (;;) {
    try {
      const n = await runBatch();
      if (n > 0) console.log(`[relay] published ${n} event(s)`);
    } catch (err) {
      console.error("[relay] batch error", err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

loop().catch((err) => {
  console.error("[relay] fatal", err);
  process.exit(1);
});
