import type { AppFieldErrors } from './app-field-errors';
import { AppErrorCode } from './app-error-code';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: AppFieldErrors,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
