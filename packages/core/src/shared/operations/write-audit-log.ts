import type { Prisma } from '@critiq/db';
import type { AuditArgs, AuditOptions } from './audit-options';

export async function writeAuditLog<TInput, TResult>(
  action: string,
  audit: AuditOptions<TInput, TResult>,
  args: AuditArgs<TInput, TResult>,
): Promise<void> {
  if (!audit.entityType.trim()) {
    throw new Error('Audit records require an entity type.');
  }

  const { ctx } = args;
  const before = audit.getBefore?.(args);
  const after = audit.getAfter?.(args);
  const metadata = {
    source: ctx.source,
    ...(ctx.request.requestId ? { requestId: ctx.request.requestId } : {}),
    ...(ctx.request.userAgent ? { userAgent: ctx.request.userAgent } : {}),
    ...(ctx.actor.type === 'system'
      ? { systemService: ctx.actor.service }
      : { actorRole: ctx.actor.role }),
    ...(before !== undefined ? { before } : {}),
    ...(after !== undefined ? { after } : {}),
  } as Prisma.InputJsonValue;

  await ctx.db.auditLog.create({
    data: {
      hackathonId: ctx.hackathonId,
      actorId: ctx.actor.type === 'user' ? ctx.actor.userId : null,
      action,
      entityType: audit.entityType,
      entityId: audit.getEntityId(args),
      metadata,
      ipAddress: ctx.request.ipAddress,
    },
  });
}
