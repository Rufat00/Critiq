import { createQuery } from '../../shared/operations';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import { importProjectsSchema } from '../schemas/import-projects-schema';
import { prepareProjectImport } from '../lib/prepare-project-import';

export const previewProjectImport = createQuery({
  name: 'projects.preview-import',
  schema: importProjectsSchema,
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx, input }) => {
  const hackathon = await ctx.db.hackathon.findUnique({
    where: { id: requireHackathonId(ctx) },
    select: { status: true },
  });
  if (hackathon?.status !== 'DRAFT')
    throw new AppError(
      AppErrorCode.INVALID_STATE,
      'Return the hackathon to draft before importing projects.',
    );
  const prepared = await prepareProjectImport(ctx, input);
  return {
    ...prepared,
    projects: prepared.projects.map((p) => ({
      name: p.name,
      trackName: p.trackName,
      challenges: p.challengeIds.length,
      rowNumber: p.rowNumber,
    })),
  };
});
export type ProjectImportPreview = Awaited<
  ReturnType<typeof previewProjectImport>
>;
