import { createMutation } from '../../shared/operations';
import { AppError, AppErrorCode } from '../../shared/errors';
import { setupCompletionSchema } from '../schemas/setup-completion-schema';
import { readSetupSnapshot } from '../lib/read-setup-snapshot';
import { buildSetupSummary } from '../lib/build-setup-summary';
import { lockDraft } from '../lib/lock-draft';

export const setSetupCompletion = createMutation({
  name: 'hackathon.set-setup-completion',
  schema: setupCompletionSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const id = await lockDraft(ctx);
    const summary = buildSetupSummary(await readSetupSnapshot(ctx));
    const section = summary.sections.find((s) => s.id === input.section)!;
    if (section.id === 'event')
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Event creation is completed automatically when your hackathon has a name.',
      );
    if (section.fingerprint !== input.fingerprint)
      throw new AppError(
        AppErrorCode.CONFLICT,
        'This section changed. Refresh and check the latest setup.',
      );
    if (input.completed && !section.canComplete)
      throw new AppError(
        AppErrorCode.INVALID_STATE,
        'Set up this section before marking it as done.',
      );
    if (ctx.actor.type !== 'user')
      throw new AppError(
        AppErrorCode.FORBIDDEN,
        'An organizer must update the checklist.',
      );
    if (input.completed) {
      await ctx.db.setupCompletion.upsert({
        where: {
          hackathonId_section: { hackathonId: id, section: input.section },
        },
        create: {
          hackathonId: id,
          section: input.section,
          fingerprint: section.fingerprint,
          completedById: ctx.actor.userId,
        },
        update: {
          fingerprint: section.fingerprint,
          completedById: ctx.actor.userId,
          completedAt: new Date(),
        },
      });
    } else {
      await ctx.db.setupCompletion.deleteMany({
        where: { hackathonId: id, section: input.section },
      });
    }
    return {
      id,
      section: input.section,
      completed: input.completed,
      previouslyCompleted: section.done,
    };
  },
  {
    audit: {
      entityType: 'Hackathon',
      getEntityId: ({ result }) => result.id,
      getBefore: ({ result }) => ({
        section: result.section,
        completed: result.previouslyCompleted,
      }),
      getAfter: ({ result }) => ({
        section: result.section,
        completed: result.completed,
      }),
    },
  },
);
