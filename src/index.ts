import { config } from './config.js';
import { logger } from './logger.js';
import { initDatabase } from './db/schema.js';

async function main() {
  logger.info('AutoScout starting...');

  // Initialize database
  const db = await initDatabase();
  logger.info('Database initialized');

  // TODO: Start Express server (Phase 3)
  // TODO: Start scheduler (Phase 7)

  logger.info(`AutoScout ready on port ${config.port}`);
}

main().catch((err) => {
  logger.error(err, 'Fatal error during startup');
  process.exit(1);
});
