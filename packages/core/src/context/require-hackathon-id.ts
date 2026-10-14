import { AppError, AppErrorCode } from '../shared/errors';
import type { AppContext } from './app-context';

export function requireHackathonId(ctx: AppContext): string {
  if (!ctx.hackathonId) {
    throw new AppError(
      AppErrorCode.INVALID_STATE,
      'The hackathon has not been configured yet.',
    );
  }
  return ctx.hackathonId;
}
