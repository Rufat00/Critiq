import type { Prisma } from '@critiq/db';
import type { z } from 'zod';
import type { AppContext } from '../../context';
import type { AuditOptions } from './audit-options';
import {
  createOperation,
  type OperationArgs,
  type OperationOptions,
} from './create-operation';
import { writeAuditLog } from './write-audit-log';

export function createMutation<TSchema extends z.ZodType>(
  options: OperationOptions<TSchema>,
) {
  return function <TResult>(
    handler: (args: OperationArgs<z.output<TSchema>>) => Promise<TResult>,
    settings?: { audit?: AuditOptions<z.output<TSchema>, TResult> },
  ) {
    return createOperation('mutation', options, async ({ ctx, input }) => {
      const audit = settings?.audit;
      if (!audit) return handler({ ctx, input });

      const runWithAudit = async (transactionContext: AppContext) => {
        const result = await handler({ ctx: transactionContext, input });
        await writeAuditLog(options.name, audit, {
          ctx: transactionContext,
          input,
          result,
        });
        return result;
      };

      if ('$transaction' in ctx.db) {
        return ctx.db.$transaction((transactionDb: Prisma.TransactionClient) =>
          runWithAudit({ ...ctx, db: transactionDb }),
        );
      }

      return runWithAudit(ctx);
    });
  };
}
