import { initDatabase } from '../src/db/schema.js';
import { createServer } from '../src/server.js';

async function main() {
  await initDatabase();

  const app = createServer();
  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', () => resolve());
      server.once('error', (err) => reject(err));
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to resolve smoke test server address');
    }

    const base = `http://127.0.0.1:${address.port}`;
    const endpoints = ['/api/health', '/api/stats', '/api/settings', '/api/scraper-health'];

    for (const endpoint of endpoints) {
      const res = await fetch(`${base}${endpoint}`);
      if (!res.ok) {
        throw new Error(`Smoke test failed: ${endpoint} returned ${res.status}`);
      }
    }

    console.log('Smoke test passed');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Smoke test failed: ${message}`);
  process.exit(1);
});
