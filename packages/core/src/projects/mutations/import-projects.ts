import { randomUUID } from 'node:crypto';
import { createMutation } from '../../shared/operations';
import { lockDraft } from '../../hackathon/lib/lock-draft';
import { importProjectsSchema } from '../schemas/import-projects-schema';
import { prepareProjectImport } from '../lib/prepare-project-import';

export const importProjects = createMutation({
  name: 'projects.import',
  schema: importProjectsSchema,
  roles: ['OWNER', 'ADMIN'],
})(
  async ({ ctx, input }) => {
    const hackathonId = await lockDraft(ctx);
    // Re-resolve names and duplicates under the same lock used by setup mutations.
    const prepared = await prepareProjectImport(ctx, input);
    const entries = prepared.projects.map((project) => ({
      ...project,
      id: randomUUID(),
    }));
    if (entries.length) {
      await ctx.db.project.createMany({
        data: entries.map(
          ({
            challengeIds: _challenges,
            trackName: _track,
            rowNumber: _row,
            ...data
          }) => ({ ...data, hackathonId }),
        ),
      });
      const challenges = entries.flatMap((project) =>
        project.challengeIds.map((challengeId) => ({
          projectId: project.id,
          challengeId,
        })),
      );
      if (challenges.length)
        await ctx.db.projectChallenge.createMany({ data: challenges });
    }
    const ids = entries.map((project) => project.id);
    return {
      added: ids.length,
      notSubmitted: prepared.notSubmitted,
      duplicates: prepared.duplicates,
      ids,
    };
  },
  {
    audit: {
      entityType: 'ProjectImport',
      getEntityId: () => null,
      getAfter: ({ input, result }) => ({ format: input.format, ...result }),
    },
  },
);
