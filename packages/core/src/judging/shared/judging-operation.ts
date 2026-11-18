import { z } from 'zod';
import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { createMutation, createQuery } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import type { AuditJson } from '../../shared/operations/audit-options';
export function invalid(message: string): never {
  throw new AppError(AppErrorCode.INVALID_STATE, message);
}
export function conflict(message: string): never {
  throw new AppError(AppErrorCode.CONFLICT, message);
}
export function forbidden(): never {
  throw new AppError(
    AppErrorCode.FORBIDDEN,
    'You do not have access to this judging operation.',
  );
}
export const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Exclude<AuditJson, null>;
export async function lockJudging(ctx: AppContext) {
  const id = requireHackathonId(ctx);
  const event = await ctx.db.hackathon.findUnique({ where: { id } });
  if (!event) invalid('Hackathon is unavailable.');
  // All judging writes and setup stage changes serialize on the same database row.
  await ctx.db.hackathon.update({
    where: { id },
    data: { updatedAt: new Date() },
  });
  const current = await ctx.db.hackathon.findUniqueOrThrow({ where: { id } });
  if (ctx.actor.type !== 'user') forbidden();
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.actor.userId },
  });
  if (!user?.isActive || user.role !== ctx.actor.role) forbidden();
  return current;
}
export function judgingMutation<S extends z.ZodType>(
  name: string,
  schema: S,
  organizer = false,
) {
  return function <R>(
    handler: (args: {
      ctx: AppContext;
      input: z.output<S>;
      event: Awaited<ReturnType<typeof lockJudging>>;
    }) => Promise<R>,
  ) {
    return createMutation({
      name,
      schema,
      roles: organizer ? ['OWNER', 'ADMIN'] : ['JUDGE', 'OWNER', 'ADMIN'],
    })(
      async ({ ctx, input }) => {
        const event = await lockJudging(ctx);
        return handler({ ctx, input, event });
      },
      {
        audit: {
          entityType: 'Judging',
          getEntityId: ({ ctx }) => ctx.hackathonId,
          getAfter: ({ input, result }) => json({ input, result }),
        },
      },
    );
  };
}
export function judgingQuery<S extends z.ZodType>(
  name: string,
  schema: S,
  organizer = false,
) {
  return function <R>(
    handler: (args: { ctx: AppContext; input: z.output<S> }) => Promise<R>,
  ) {
    return createQuery({
      name,
      schema,
      roles: organizer ? ['OWNER', 'ADMIN'] : ['JUDGE', 'OWNER', 'ADMIN'],
    })(async (args) => {
      if (args.ctx.actor.type !== 'user') forbidden();
      const user = await args.ctx.db.user.findUnique({
        where: { id: args.ctx.actor.userId },
      });
      if (!user?.isActive || user.role !== args.ctx.actor.role) forbidden();
      if ('$transaction' in args.ctx.db)
        return args.ctx.db.$transaction(
          (tx) => handler({ ...args, ctx: { ...args.ctx, db: tx } }),
          { isolationLevel: 'RepeatableRead', timeout: 30000 },
        );
      return handler(args);
    });
  };
}
