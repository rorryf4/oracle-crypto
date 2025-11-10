/**
 * Small helpers for Oracle Systems Crypto Scanner
 */

/**
 * Safely parse environment variable as integer with fallback
 */
export function envInt(key, fallback) {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse comma-separated list from environment variable
 */
export function envList(key, fallback = []) {
  const val = process.env[key];
  if (!val) return fallback;
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Format timestamp for logging
 */
export function timestamp() {
  return new Date().toISOString();
}

/**
 * Safe logger with timestamp
 */
export function log(...args) {
  console.log(`[${timestamp()}]`, ...args);
}

/**
 * Error logger
 */
export function logError(...args) {
  console.error(`[${timestamp()}] ERROR:`, ...args);
}
