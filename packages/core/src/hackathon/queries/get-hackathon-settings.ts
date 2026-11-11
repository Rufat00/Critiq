import { z } from 'zod';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import { createQuery } from '../../shared/operations';

export const getHackathonSettings = createQuery({
  name: 'hackathon.settings',
  schema: z.object({}),
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx }) => {
  const settings = await ctx.db.hackathon.findUnique({
    where: { id: requireHackathonId(ctx) },
    select: {
      id: true,
      name: true,
      scoreScale: true,
      roomSwitchPercent: true,
      status: true,
    },
  });
  if (!settings)
    throw new AppError(AppErrorCode.NOT_FOUND, 'Hackathon not found.');
  return {
    ...settings,
    canResetData: ctx.actor.type === 'user' && ctx.actor.role === 'OWNER',
  };
});
export type HackathonSettings = Awaited<
  ReturnType<typeof getHackathonSettings>
>;
