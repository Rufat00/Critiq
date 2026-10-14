import { db as defaultDb, type PrismaClient } from '@critiq/db';
import type { AppContext, AppSource } from './app-context';
import type { RequestMetadata } from './request-metadata';

export type CreateSystemContextInput = {
  service: string;
  source: AppSource;
  hackathonId?: string | null;
  request?: RequestMetadata;
  db?: PrismaClient;
};

export function createSystemContext({
  service,
  source,
  hackathonId = null,
  request = { ipAddress: null, userAgent: null },
  db = defaultDb,
}: CreateSystemContextInput): AppContext {
  return {
    db,
    actor: { type: 'system', service },
    hackathonId,
    source,
    request,
  };
}
