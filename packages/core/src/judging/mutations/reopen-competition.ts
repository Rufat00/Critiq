import { reopenCompetitionSchema } from '../schemas/reopen-competition-schema';
import { judgingMutation, invalid } from '../shared/judging-operation';
export const reopenCompetition = judgingMutation(
  'judging.competitions.reopen',
  reopenCompetitionSchema,
  true,
)(async ({ ctx, input, event }) => {
  if (!['PAUSED', 'DELIBERATION', 'COMPLETED'].includes(event.status))
    invalid('Pause judging before reopening a competition.');
  const category = await ctx.db.judgingCategory.findFirst({
    where: { id: input.categoryId, hackathonId: event.id, isEnabled: true },
  });
  if (!category) invalid('Competition is unavailable.');
  await ctx.db.competitionResultSnapshot.updateMany({
    where: { categoryId: category.id, supersededAt: null },
    data: { supersededAt: new Date() },
  });
  await ctx.db.judgingCategory.update({
    where: { id: category.id },
    data: { status: 'PAUSED', endedAt: null },
  });
  await ctx.db.hackathon.update({
    where: { id: event.id },
    data: { status: 'PAUSED' },
  });
  return { categoryId: category.id, reason: input.reason };
});
