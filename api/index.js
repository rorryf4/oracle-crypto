/**
 * Oracle Systems Crypto Scanner API
 * Fastify server exposing /health, /ticks, /signals endpoints
 */
import Fastify from "fastify";
import dotenv from "dotenv";
import { envInt, log } from "../lib/utils.js";
dotenv.config();

const PORT = envInt("PORT", 4100);

// In-memory stores
const ticks = [];
const signals = [];
const MAX_TICKS = 1000;
const MAX_SIGNALS = 500;

const app = Fastify({ logger: false });

app.get("/health", async () => ({
  status: "ok",
  service: "crypto-scanner",
  timestamp: new Date().toISOString()
}));

app.get("/ticks", async (req) => {
  const { symbol, limit } = req.query ?? {};
  let result = ticks;
  if (symbol) result = result.filter(t => t.symbol === symbol);
  const lim = Number(limit) || 100;
  result = result.slice(-lim);
  return { count: result.length, data: result };
});

app.post("/ticks", async (req, reply) => {
  const tick = req.body;
  if (!tick || !tick.symbol || typeof tick.close !== "number") {
    return reply.code(400).send({ error: "Invalid tick data" });
  }
  ticks.push({ ...tick, receivedAt: Date.now() });
  if (ticks.length > MAX_TICKS) ticks.splice(0, ticks.length - MAX_TICKS);
  return { success: true };
});

app.get("/signals", async (req) => {
  const { symbol, kind, limit } = req.query ?? {};
  let result = signals;
  if (symbol) result = result.filter(s => s.symbol === symbol);
  if (kind) result = result.filter(s => s.kind === kind);
  const lim = Number(limit) || 50;
  result = result.slice(-lim);
  return { count: result.length, data: result };
});

app.post("/signals", async (req, reply) => {
  const signal = req.body;
  if (!signal || !signal.symbol || !signal.kind)
    return reply.code(400).send({ error: "Invalid signal data" });

  signals.push({ ...signal, timestamp: Date.now(), createdAt: new Date().toISOString() });
  log(`?? Signal: ${signal.symbol} ${signal.kind} score=${signal.score}`);
  if (signals.length > MAX_SIGNALS) signals.splice(0, signals.length - MAX_SIGNALS);
  return { success: true };
});

const port = Number(PORT);
app.listen({ port, host: "0.0.0.0" })
  .then(() => {
    log(`?? Crypto Scanner API running on http://localhost:${port}`);
    log(`Endpoints: /health, /ticks, /signals`);
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });