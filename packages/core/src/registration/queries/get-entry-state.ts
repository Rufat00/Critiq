import { z } from 'zod';
import { createQuery } from '../../shared/operations';

export const getEntryState = createQuery({
  name: 'registration.entry',
  schema: z.object({}),
  allowSystem: true,
})(async ({ ctx }) => {
  const [installation, hackathon] = await Promise.all([
    ctx.db.installation.findUnique({ where: { id: 1 } }),
    ctx.db.hackathon.findFirst({
      select: { id: true, name: true, status: true },
    }),
  ]);
  return {
    setupRequired: !installation?.claimedAt,
    configurationRequired: !hackathon?.name?.trim(),
    hackathonName: hackathon?.name || 'Hackathon',
    hackathonStatus: hackathon?.status ?? null,
    hackathonId: hackathon?.id ?? null,
  };
});
