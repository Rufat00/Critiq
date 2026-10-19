import type { AppContext } from '../../context';
import { requireHackathonId } from '../../context';
import { AppError, AppErrorCode } from '../../shared/errors';
import type { ImportProjectsInput } from '../schemas/import-projects-schema';
import { createProjectSchema } from '../schemas/create-project-schema';
import { parseProjectCsv } from './parse-project-csv';
import { projectData } from './project-data';

const normalize = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

export async function prepareProjectImport(
  ctx: AppContext,
  input: ImportProjectsInput,
) {
  const hackathonId = requireHackathonId(ctx);
  const rows = parseProjectCsv(input.csv, input.format);
  const [categories, existing] = await Promise.all([
    ctx.db.judgingCategory.findMany({
      where: { hackathonId },
      select: {
        name: true,
        kind: true,
        track: { select: { id: true } },
        challenge: {
          select: {
            id: true,
            includesOverall: true,
            allowedTracks: { select: { trackId: true } },
          },
        },
      },
    }),
    ctx.db.project.findMany({
      where: { hackathonId },
      select: { name: true, externalId: true, submissionUrl: true },
    }),
  ]);
  const externalIds = new Set(
    existing.map((p) => p.externalId).filter(Boolean),
  );
  const urls = new Set(existing.map((p) => p.submissionUrl).filter(Boolean));
  const titlesWithoutUrl = new Set(
    existing.filter((p) => !p.submissionUrl).map((p) => normalize(p.name)),
  );
  const projects: Array<
    ReturnType<typeof projectData> & {
      challengeIds: string[];
      trackName: string;
      rowNumber: number;
    }
  > = [];
  const errors: string[] = [];
  let notSubmitted = 0,
    duplicates = 0;
  for (const row of rows) {
    if (!row.isSubmitted) {
      notSubmitted++;
      continue;
    }
    if (
      (row.externalId && externalIds.has(row.externalId)) ||
      (row.submissionUrl && urls.has(row.submissionUrl)) ||
      (!row.submissionUrl && titlesWithoutUrl.has(normalize(row.name)))
    ) {
      duplicates++;
      continue;
    }
    const track = row.trackName
      ? categories.find(
          (c) =>
            c.kind !== 'CHALLENGE' &&
            normalize(c.name) === normalize(row.trackName!),
        )
      : categories.find((c) => c.kind === 'OVERALL');
    if (!track || (track.kind === 'TRACK' && !track.track)) {
      errors.push(
        `Row ${row.rowNumber}: unknown track “${row.trackName ?? 'Overall'}”. Create it in Judging Categories first.`,
      );
      continue;
    }
    const trackId = track.track?.id ?? null;
    const challengeIds: string[] = [];
    let invalidChallenges = false;
    for (const name of new Set(row.challengeNames.map(normalize))) {
      const category = categories.find(
        (c) => c.kind === 'CHALLENGE' && normalize(c.name) === name,
      );
      const challenge = category?.challenge;
      // Devpost opt-in prizes may include awards that are not judged in Critiq.
      if (!challenge && input.format === 'devpost') continue;
      if (
        !challenge ||
        !(trackId
          ? challenge.allowedTracks.some((t) => t.trackId === trackId)
          : challenge.includesOverall)
      ) {
        errors.push(
          `Row ${row.rowNumber}: challenge “${name}” does not exist or does not include ${track.name}.`,
        );
        invalidChallenges = true;
      } else challengeIds.push(challenge.id);
    }
    if (invalidChallenges) continue;
    const parsed = createProjectSchema.safeParse({
      ...row,
      trackId,
      challengeIds,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        errors.push(
          `Row ${row.rowNumber}, ${issue.path.join('.')}: ${issue.message}`,
        );
      continue;
    }
    projects.push({
      ...projectData(parsed.data),
      challengeIds,
      trackName: track.name,
      rowNumber: row.rowNumber,
    });
    if (row.externalId) externalIds.add(row.externalId);
    if (row.submissionUrl) urls.add(row.submissionUrl);
    else titlesWithoutUrl.add(normalize(row.name));
  }
  if (errors.length)
    throw new AppError(
      AppErrorCode.VALIDATION_ERROR,
      'Fix the CSV before importing. No projects were added.',
      { csv: errors.slice(0, 20) },
    );
  return { projects, notSubmitted, duplicates, totalRows: rows.length };
}
