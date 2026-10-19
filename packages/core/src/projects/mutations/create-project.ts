import { createMutation } from '../../shared/operations';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { createProjectSchema } from '../schemas/create-project-schema';
import { validateProjectMembership } from '../lib/validate-project-membership';
import { projectData } from '../lib/project-data';

export const createProject = createMutation({
  name: 'projects.create',
  schema: createProjectSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    const challengeIds = await validateProjectMembership(
      ctx,
      input.trackId,
      input.challengeIds,
    );
    return ctx.db.project.create({
      data: {
        ...projectData(input),
        hackathonId,
        challenges: {
          create: challengeIds.map((challengeId) => ({ challengeId })),
        },
      },
      select: { id: true, name: true, trackId: true },
    });
  },
  {
    audit: {
      entityType: 'Project',
      getEntityId: ({ result }) => result.id,
      getAfter: ({ result, input }) => ({
        ...result,
        challengeIds: input.challengeIds,
      }),
    },
  },
);
