import { z } from 'zod';
import { createQuery } from '../../shared/operations';
import { readSetupSnapshot } from '../lib/read-setup-snapshot';
import { buildSetupSummary } from '../lib/build-setup-summary';

export const getHackathonHome = createQuery({
  name: 'hackathon.home',
  schema: z.object({}),
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx }) => {
  if ('$transaction' in ctx.db) {
    return ctx.db.$transaction(
      async (db) => buildSetupSummary(await readSetupSnapshot({ ...ctx, db })),
      { isolationLevel: 'RepeatableRead' },
    );
  }
  return buildSetupSummary(await readSetupSnapshot(ctx));
});
