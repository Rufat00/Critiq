import { z } from 'zod';
import { requireHackathonId } from '../../context';
import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';

export const returnHackathonToDraft = createMutation({
  name: 'hackathon.return-to-draft',
  schema: z.object({}),
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx }) => {
    const id = requireHackathonId(ctx);
    const updated = await ctx.db.hackathon.updateMany({
      where: { id, status: 'READY' },
      data: { status: 'DRAFT' },
    });
    if (updated.count !== 1)
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Only a ready hackathon can return to draft.',
      );
    return { id };
  },
  {
    audit: {
      entityType: 'Hackathon',
      getEntityId: ({ result }) => result.id,
      getBefore: () => ({ status: 'READY' }),
      getAfter: () => ({ status: 'DRAFT' }),
    },
  },
);
