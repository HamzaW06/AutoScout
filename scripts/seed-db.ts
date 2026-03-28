import { initDatabase } from '../src/db/schema.js';
import { seedModelIntelligence } from '../src/db/seed-models.js';
import { seedPartsPricing } from '../src/db/seed-parts.js';

async function main() {
  console.log('Initializing database...');
  await initDatabase();
  console.log('Database initialized with all tables and indexes.');

  console.log('\nSeeding model intelligence...');
  await seedModelIntelligence();

  console.log('\nSeeding parts pricing...');
  seedPartsPricing();

  console.log('\nDone! Database is ready.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
