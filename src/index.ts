import { config } from './config.js';
import { logger } from './logger.js';
import { initDatabase } from './db/schema.js';
import { createServer, startServer } from './server.js';
import { startScheduler } from './scheduler.js';

async function main() {
  logger.info('AutoScout starting...');

  // Initialize database
  const db = await initDatabase();
  logger.info('Database initialized');

  // Start Express server
  const app = createServer();
  startServer(app);

  // Start cron scheduler
  startScheduler();

  logger.info(`AutoScout ready on port ${config.port}`);
}

main().catch((err) => {
  logger.error(err, 'Fatal error during startup');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

process.on('uncaughtException', (error) => {
  logger.error(error, 'Uncaught exception');
  process.exit(1);
});
