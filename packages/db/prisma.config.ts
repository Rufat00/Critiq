import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

// Root .env is for local CLI usage. Deployment environment values take precedence.
config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --env-file-if-exists=../../.env prisma/seed.ts',
  },
  datasource: {
    // Generation and schema validation can run without a live database.
    // Commands that connect require DATABASE_URL; runtime also checks it explicitly.
    url: process.env.DATABASE_URL ?? '',
  },
});
