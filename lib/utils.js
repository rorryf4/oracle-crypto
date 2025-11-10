/**
 * Small helpers for Oracle Systems Crypto Scanner
 */
export function envInt(key, fallback) {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}
export function envList(key, fallback = []) {
  const val = process.env[key];
  if (!val) return fallback;
  return val.split(",").map(s => s.trim()).filter(Boolean);
}
export function timestamp() {
  return new Date().toISOString();
}
export function log(...args) {
  console.log(`[${timestamp()}]`, ...args);
}
export function logError(...args) {
  console.error(`[${timestamp()}] ERROR:`, ...args);
}