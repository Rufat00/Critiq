import type { AppContext } from '../../context';
import { requireUserRole } from '../../context';
import type { UserRole } from '@critiq/db';
import type { z } from 'zod';
import { AppError, AppErrorCode, normalizePrismaError } from '../errors';

export type OperationArgs<TInput> = {
  ctx: AppContext;
  input: TInput;
};

export type OperationOptions<TSchema extends z.ZodType> = {
  name: string;
  schema: TSchema;
  roles?: readonly UserRole[];
  allowSystem?: boolean;
};

export function createOperation<TSchema extends z.ZodType, TResult>(
  kind: 'query' | 'mutation',
  options: OperationOptions<TSchema>,
  handler: (args: OperationArgs<z.output<TSchema>>) => Promise<TResult>,
) {
  if (!options.name.trim()) {
    throw new Error('Core operations require a stable name.');
  }

  async function operation(
    ctx: AppContext,
    rawInput: z.input<TSchema>,
  ): Promise<TResult> {
    try {
      if (!ctx?.db || !ctx.actor || !ctx.request || !ctx.source) {
        throw new AppError(
          AppErrorCode.UNAUTHORIZED,
          'A valid context is required.',
        );
      }
      if (ctx.actor.type === 'system') {
        if (!options.allowSystem || options.roles) {
          throw new AppError(AppErrorCode.FORBIDDEN, 'You cannot do that.');
        }
      } else if (options.roles) {
        requireUserRole(ctx, options.roles);
      }

      const parsed = await options.schema.safeParseAsync(rawInput);
      if (!parsed.success) {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path.map(String).join('.') || '_form';
          (fieldErrors[field] ??= []).push(issue.message);
        }
        throw new AppError(
          AppErrorCode.VALIDATION_ERROR,
          'Please fix the highlighted fields.',
          fieldErrors,
        );
      }
      return await handler({ ctx, input: parsed.data });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const prismaError = normalizePrismaError(error);
      if (prismaError) throw prismaError;

      console.error('Core operation failed.', {
        kind,
        operation: options.name,
        requestId: ctx?.request?.requestId,
        actorType: ctx?.actor?.type,
        userId: ctx?.actor?.type === 'user' ? ctx.actor.userId : undefined,
        hackathonId: ctx?.hackathonId,
        source: ctx?.source,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      throw new AppError(
        AppErrorCode.INTERNAL_SERVER_ERROR,
        'Something went wrong. Please try again.',
      );
    }
  }

  return Object.assign(operation, { operationName: options.name });
}
