import { createServer as createHttpServer } from 'http';
import { config } from './config.js';
import { logger } from './logger.js';
import { initDatabase } from './db/schema.js';
import { createServer } from './server.js';
import { startScheduler, runListingFetch } from './scheduler.js';
import { initWebSocket } from './websocket.js';

async function main() {
  logger.info('AutoScout starting...');

  // Initialize database
  const db = await initDatabase();
  logger.info('Database initialized');

  // Create Express app and wrap in HTTP server
  const app = createServer();
  const httpServer = createHttpServer(app);

  // Attach WebSocket server to the HTTP server
  initWebSocket(httpServer);

  // Start listening
  httpServer.listen(config.port, config.host, () => {
    logger.info(`API server listening on http://${config.host}:${config.port}`);
  });

  // Start cron scheduler
  startScheduler();

  logger.info(`AutoScout ready on port ${config.port}`);

  // Run initial listing fetch 5 seconds after startup so DB is fully settled
  setTimeout(() => {
    logger.info('Running initial listing fetch on startup...');
    runListingFetch().catch((err) => logger.error(err, 'Initial listing fetch failed'));
  }, 5_000);
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
