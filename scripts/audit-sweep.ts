import { initDatabase } from '../src/db/schema.js';
import { nightlyAuditSweep } from '../src/audit/sweep.js';
import { logger } from '../src/logger.js';

async function main() {
  await initDatabase();
  logger.info('Running nightly audit sweep now...');
  await nightlyAuditSweep();
  logger.info('Audit sweep completed');
}

main().catch((err) => {
  logger.error(err, 'audit-sweep failed');
  process.exit(1);
});
