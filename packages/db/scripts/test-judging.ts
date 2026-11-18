import { config } from 'dotenv';
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
config({ path: new URL('../../../.env', import.meta.url), quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error(
    'DATABASE_URL is required to create an isolated test database.',
  );
const admin = new Client({ connectionString: process.env.DATABASE_URL });
const databaseName = `critiq_judging_test_${randomBytes(8).toString('hex')}`;
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${databaseName}`;
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  CRITIQ_JUDGING_INTEGRATION: '1',
};
await admin.connect();
let created = false;
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  for (const args of [
    ['--filter', '@critiq/db', 'exec', 'prisma', 'migrate', 'deploy'],
    [
      '--filter',
      '@critiq/db',
      'exec',
      'prisma',
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ],
    [
      '--filter',
      '@critiq/db',
      'exec',
      'node',
      '--import',
      'tsx',
      'prisma/seed.ts',
    ],
  ]) {
    const run = spawnSync('pnpm', args, { cwd: root, env, stdio: 'inherit' });
    if (run.status !== 0) throw new Error('Test database setup failed.');
  }
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      './packages/db/node_modules/tsx/dist/loader.mjs',
      '--test',
      '--test-concurrency=1',
      process.argv.includes('--npc')
        ? 'packages/core/src/judging/mutations/npc-judges.integration.test.ts'
        : 'packages/core/src/judging/mutations/judging.integration.test.ts',
    ],
    { cwd: root, env, stdio: 'inherit' },
  );
  process.exitCode = run.status ?? 1;
} finally {
  if (created) {
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [databaseName],
    );
    await admin.query(`DROP DATABASE "${databaseName}"`);
  }
  await admin.end();
}
