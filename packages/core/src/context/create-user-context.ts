import { db as defaultDb, type PrismaClient } from '@critiq/db';
import { AppError, AppErrorCode } from '../shared/errors';
import type { AppContext, AppSource } from './app-context';
import type { RequestMetadata } from './request-metadata';

export type CreateUserContextInput = {
  userId: string;
  source: AppSource;
  request: RequestMetadata;
  db?: PrismaClient;
};

export async function createUserContext({
  userId,
  source,
  request,
  db = defaultDb,
}: CreateUserContextInput): Promise<AppContext> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user?.isActive) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, 'You must be signed in.');
  }

  const hackathon = await db.hackathon.findFirst({ select: { id: true } });
  return {
    db,
    actor: { type: 'user', userId: user.id, role: user.role },
    hackathonId: hackathon?.id ?? null,
    source,
    request,
  };
}
