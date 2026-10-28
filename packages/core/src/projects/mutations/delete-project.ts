import { reassignProjectLocations } from '../lib/reassign-project-locations';
import { createMutation } from '../../shared/operations';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { deleteProjectSchema } from '../schemas/delete-project-schema';
import { requireProject } from '../lib/require-project';

export const deleteProject = createMutation({
  name: 'projects.delete',
  schema: deleteProjectSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    await lockDraft(ctx);
    const project = await requireProject(ctx, input.projectId);
    await ctx.db.project.delete({ where: { id: project.id } });
    await reassignProjectLocations(ctx);
    return {
      id: project.id,
      name: project.name,
      trackId: project.trackId,
      roomId: project.roomId,
      tableNumber: project.tableNumber,
      challengeIds: project.challenges.map((c) => c.challengeId),
    };
  },
  {
    audit: {
      entityType: 'Project',
      getEntityId: ({ result }) => result.id,
      getBefore: ({ result }) => result,
      getAfter: () => ({ deleted: true }),
    },
  },
);
