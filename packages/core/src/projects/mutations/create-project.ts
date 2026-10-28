import { reassignProjectLocations } from '../lib/reassign-project-locations';
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
    const project = await ctx.db.project.create({
      data: {
        ...projectData(input),
        hackathonId,
        challenges: {
          create: challengeIds.map((challengeId) => ({ challengeId })),
        },
      },
      select: { id: true, name: true, trackId: true },
    });
    const locations = await reassignProjectLocations(ctx);
    const location = locations.find((item) => item.id === project.id)!;
    return {
      ...project,
      roomId: location.roomId,
      tableNumber: location.tableNumber,
    };
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
