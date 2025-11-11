import { logger } from '@aether/shared';
import { Database } from './db.js';
import { StreamManager } from './stream.js';

async function main() {
  logger.info({
    module: 'ingestor',
    event: 'starting',
    ts: new Date().toISOString(),
  });

  const db = new Database();
  const stream = new StreamManager(db);

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    logger.info({
      module: 'ingestor',
      event: 'shutdown',
      ts: new Date().toISOString(),
    });
    await stream.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info({
      module: 'ingestor',
      event: 'shutdown',
      ts: new Date().toISOString(),
    });
    await stream.stop();
    process.exit(0);
  });

  await stream.start();

  logger.info({
    module: 'ingestor',
    event: 'running',
    ts: new Date().toISOString(),
  });
}

main().catch((error) => {
  logger.error({
    module: 'ingestor',
    event: 'fatal_error',
    ts: new Date().toISOString(),
    details: { error: error.message, stack: error.stack },
  });
  process.exit(1);
});
