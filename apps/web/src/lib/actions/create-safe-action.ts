import type { AppContext } from '@critiq/core/context';
import {
  AppError,
  AppErrorCode,
  normalizePrismaError,
  type AppFieldErrors,
} from '@critiq/core/errors';
import { createWebAppContext } from '@/lib/core/create-web-app-context';

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: AppErrorCode;
        message: string;
        fieldErrors?: AppFieldErrors;
      };
    };

type CoreOperation<TInput, TResult> = (
  ctx: AppContext,
  input: TInput,
) => Promise<TResult>;

type NamedCoreOperation<TInput, TResult> = CoreOperation<TInput, TResult> & {
  operationName?: string;
};

export function createSafeAction<TInput, TResult>(
  operation: NamedCoreOperation<TInput, TResult>,
) {
  return async function action(
    rawInput: TInput,
  ): Promise<ActionResult<TResult>> {
    let ctx: AppContext | undefined;
    try {
      ctx = await createWebAppContext();
      return { ok: true, data: await operation(ctx, rawInput) };
    } catch (error) {
      const appError =
        error instanceof AppError ? error : normalizePrismaError(error);
      if (appError) {
        return {
          ok: false,
          error: {
            code: appError.code,
            message: appError.message,
            fieldErrors: appError.fieldErrors,
          },
        };
      }

      console.error('Safe action failed.', {
        operation: operation.operationName ?? operation.name ?? 'anonymous',
        requestId: ctx?.request.requestId,
        userId: ctx?.actor.type === 'user' ? ctx.actor.userId : undefined,
        hackathonId: ctx?.hackathonId,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      return {
        ok: false,
        error: {
          code: AppErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Something went wrong. Please try again.',
        },
      };
    }
  };
}
