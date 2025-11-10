/**
 * Oracle Systems Crypto Scanner API
 * Fastify server exposing /health, /ticks, /signals endpoints
 */

import Fastify from 'fastify';
import dotenv from 'dotenv';
import { envInt, log } from '../lib/utils.js';

// Load environment variables
dotenv.config();

const PORT = envInt('PORT', 4100);

// In-memory stores
const ticks = [];
const signals = [];

const MAX_TICKS = 1000;
const MAX_SIGNALS = 500;

// Create Fastify instance
const fastify = Fastify({
  logger: false
});

/**
 * Health check endpoint
 */
fastify.get('/health', async () => {
  return {
    status: 'ok',
    service: 'crypto-scanner',
    timestamp: new Date().toISOString()
  };
});

/**
 * Get recent ticks
 */
fastify.get('/ticks', async (request, reply) => {
  const { symbol, limit } = request.query;
  let result = ticks;

  if (symbol) {
    result = result.filter(t => t.symbol === symbol);
  }

  const limitNum = parseInt(limit) || 100;
  result = result.slice(-limitNum);

  return {
    count: result.length,
    data: result
  };
});

/**
 * Post new tick data (called by worker)
 */
fastify.post('/ticks', async (request, reply) => {
  const tick = request.body;

  if (!tick || !tick.symbol || !tick.close) {
    return reply.code(400).send({ error: 'Invalid tick data' });
  }

  ticks.push({
    ...tick,
    receivedAt: Date.now()
  });

  // Keep only recent ticks
  if (ticks.length > MAX_TICKS) {
    ticks.splice(0, ticks.length - MAX_TICKS);
  }

  return { success: true };
});

/**
 * Get recent signals
 */
fastify.get('/signals', async (request, reply) => {
  const { symbol, kind, limit } = request.query;
  let result = signals;

  if (symbol) {
    result = result.filter(s => s.symbol === symbol);
  }

  if (kind) {
    result = result.filter(s => s.kind === kind);
  }

  const limitNum = parseInt(limit) || 50;
  result = result.slice(-limitNum);

  return {
    count: result.length,
    data: result
  };
});

/**
 * Post new signal (called by worker)
 */
fastify.post('/signals', async (request, reply) => {
  const signal = request.body;

  if (!signal || !signal.symbol || !signal.kind) {
    return reply.code(400).send({ error: 'Invalid signal data' });
  }

  signals.push({
    ...signal,
    timestamp: Date.now(),
    createdAt: new Date().toISOString()
  });

  // Keep only recent signals
  if (signals.length > MAX_SIGNALS) {
    signals.splice(0, signals.length - MAX_SIGNALS);
  }

  log(`📡 Signal: ${signal.symbol} ${signal.kind} score=${signal.score}`);

  return { success: true };
});

/**
 * Start server
 */
async function start() {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    log(`🚀 Crypto Scanner API running on http://localhost:${PORT}`);
    log(`Endpoints: /health, /ticks, /signals`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
