import { config } from './config.js';
import { logger } from './logger.js';
import { initDatabase } from './db/schema.js';
import { createServer, startServer } from './server.js';

async function main() {
  logger.info('AutoScout starting...');

  // Initialize database
  const db = await initDatabase();
  logger.info('Database initialized');

  // Start Express server
  const app = createServer();
  startServer(app);

  // TODO: Start scheduler (Phase 7)

  logger.info(`AutoScout ready on port ${config.port}`);
}

main().catch((err) => {
  logger.error(err, 'Fatal error during startup');
  process.exit(1);
});
