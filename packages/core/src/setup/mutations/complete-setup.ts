import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import { createMutation } from '../../shared/operations';
import { completeSetupSchema } from '../schemas/complete-setup-schema';

export const completeSetup = createMutation({
  name: 'hackathon.complete-setup',
  schema: completeSetupSchema,
  roles: ['OWNER'],
})(
  async ({ ctx, input }) => {
    const id = requireHackathonId(ctx);
    const updated = await ctx.db.hackathon.updateMany({
      where: { id, OR: [{ name: null }, { name: '' }] },
      data: { name: input.name },
    });
    if (updated.count !== 1) {
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Setup has already been completed. Return to Admin to continue.',
      );
    }
    return { id, name: input.name };
  },
  {
    audit: {
      entityType: 'Hackathon',
      getEntityId: ({ result }) => result.id,
      getBefore: () => ({ name: null }),
      getAfter: ({ result }) => ({ name: result.name }),
    },
  },
);
