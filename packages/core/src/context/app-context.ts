import type { Prisma, PrismaClient } from '@critiq/db';
import type { AppActor } from './actor';
import type { RequestMetadata } from './request-metadata';

export type AppDatabase = PrismaClient | Prisma.TransactionClient;
export type AppSource = 'web-action' | 'web-page' | 'worker';

export type AppContext = {
  db: AppDatabase;
  actor: AppActor;
  hackathonId: string | null;
  source: AppSource;
  request: RequestMetadata;
};
