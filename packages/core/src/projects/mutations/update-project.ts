import { createMutation } from '../../shared/operations';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { updateProjectSchema } from '../schemas/update-project-schema';
import { validateProjectMembership } from '../lib/validate-project-membership';
import { requireProject } from '../lib/require-project';
import { projectData } from '../lib/project-data';

export const updateProject = createMutation({
  name: 'projects.update',
  schema: updateProjectSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    await lockDraft(ctx);
    const previous = await requireProject(ctx, input.projectId);
    const challengeIds = await validateProjectMembership(
      ctx,
      input.trackId,
      input.challengeIds,
    );
    const moved = previous.trackId !== input.trackId;
    const project = await ctx.db.project.update({
      where: { id: previous.id },
      data: {
        ...projectData(input),
        ...(moved ? { roomId: null, tableNumber: null } : {}),
        challenges: {
          deleteMany: {},
          create: challengeIds.map((challengeId) => ({ challengeId })),
        },
      },
      select: { id: true, name: true, trackId: true },
    });
    return {
      ...project,
      before: {
        name: previous.name,
        description: previous.description,
        submissionUrl: previous.submissionUrl,
        repositoryUrl: previous.repositoryUrl,
        demoUrl: previous.demoUrl,
        trackId: previous.trackId,
        challengeIds: previous.challenges.map((c) => c.challengeId),
        roomId: previous.roomId,
        tableNumber: previous.tableNumber,
      },
    };
  },
  {
    audit: {
      entityType: 'Project',
      getEntityId: ({ result }) => result.id,
      getBefore: ({ result }) => result.before,
      getAfter: ({ result, input }) => ({
        id: result.id,
        ...projectData(input),
        challengeIds: input.challengeIds,
      }),
    },
  },
);
