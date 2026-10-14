import type { UserRole } from '@critiq/db';
import { AppError, AppErrorCode } from '../shared/errors';
import type { AppContext } from './app-context';

export function requireUserRole(
  ctx: AppContext,
  allowedRoles: readonly UserRole[],
): void {
  if (ctx.actor.type !== 'user') {
    throw new AppError(AppErrorCode.UNAUTHORIZED, 'You must be signed in.');
  }
  if (!allowedRoles.includes(ctx.actor.role)) {
    throw new AppError(AppErrorCode.FORBIDDEN, 'You cannot do that.');
  }
}
