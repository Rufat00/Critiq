import { Prisma } from '@critiq/db';
import { AppError } from './app-error';
import { AppErrorCode } from './app-error-code';

export function normalizePrismaError(error: unknown): AppError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (error.code) {
    case 'P2002':
      return new AppError(
        AppErrorCode.CONFLICT,
        'A record with these details already exists.',
      );
    case 'P2003':
      return new AppError(
        AppErrorCode.CONFLICT,
        'This change conflicts with a related record.',
      );
    case 'P2025':
      return new AppError(AppErrorCode.NOT_FOUND, 'The record was not found.');
    default:
      return null;
  }
}
