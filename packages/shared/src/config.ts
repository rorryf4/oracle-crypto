import dotenv from 'dotenv';
import { Config } from './types.js';

dotenv.config();

export function loadConfig(): Config {
  return {
    pgHost: process.env.PGHOST || 'localhost',
    pgPort: parseInt(process.env.PGPORT || '5432'),
    pgUser: process.env.PGUSER || 'scanner',
    pgPassword: process.env.PGPASSWORD || 'scanner_password',
    pgDatabase: process.env.PGDATABASE || 'crypto_scanner',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    universe: (process.env.UNIVERSE || 'BTCUSDT,ETHUSDT,SOLUSDT,BONKUSDT,POPCATUSDT')
      .split(',')
      .map(s => s.trim()),
    exchange: process.env.EXCHANGE || 'binance_perp',
    binanceFuturesWs: process.env.BINANCE_FUTURES_WS || 'wss://fstream.binance.com/stream',
    binanceFuturesHttp: process.env.BINANCE_FUTURES_HTTP || 'https://fapi.binance.com',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
