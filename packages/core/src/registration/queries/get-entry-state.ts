import { z } from 'zod';
import { createQuery } from '../../shared/operations';

export const getEntryState = createQuery({
  name: 'registration.entry',
  schema: z.object({}),
  allowSystem: true,
})(async ({ ctx }) => {
  const [installation, hackathon] = await Promise.all([
    ctx.db.installation.findUnique({ where: { id: 1 } }),
    ctx.db.hackathon.findFirst({ select: { id: true, name: true } }),
  ]);
  return {
    setupRequired: !installation?.claimedAt,
    hackathonName: hackathon?.name || 'Hackathon',
    hackathonId: hackathon?.id ?? null,
  };
});
