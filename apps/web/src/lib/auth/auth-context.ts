import { getAuthSession, type AuthSession } from '@critiq/auth';
import { AppError, AppErrorCode } from '@critiq/core/errors';
import { headers } from 'next/headers';

export type AuthContext = AuthSession & {
  isAdmin(): boolean;
  isOwner(): boolean;
  isJudge(): boolean;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getAuthSession(await headers());
  if (!session) return null;

  const role = session.user.role;
  return {
    ...session,
    isAdmin: () => role === 'OWNER' || role === 'ADMIN',
    isOwner: () => role === 'OWNER',
    isJudge: () => role === 'JUDGE',
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, 'You must be signed in.');
  }
  return context;
}
