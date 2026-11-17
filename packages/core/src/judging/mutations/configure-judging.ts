import { ordinalRatingOptions } from '@critiq/constants';
import { readSetupSnapshot } from '../../hackathon/lib/read-setup-snapshot';
import { judgingSetupFingerprint } from '../shared/judging-setup-fingerprint';
import {
  configureJudgingSchema,
  type JudgingPolicy,
} from '../schemas/configure-judging-schema';
import {
  judgingMutation,
  invalid,
  conflict,
  json,
} from '../shared/judging-operation';
import { recommendCoverageTargets } from '../planning/recommend-coverage-targets';
export const configureJudging = judgingMutation(
  'judging.configure',
  configureJudgingSchema,
  true,
)(async ({ ctx, input, event }) => {
  if (!['DRAFT', 'READY', 'PAUSED'].includes(event.status))
    invalid(
      'Configure judging in Draft or Ready, or pause for an explicit amendment.',
    );
  if (event.status === 'PAUSED' && !input.amendmentReason)
    invalid('An amendment reason is required after judging starts.');
  if (new Date(input.endsAt) <= new Date())
    invalid('Judging must end in the future.');
  const old = await ctx.db.judgingConfiguration.findUnique({
    where: { hackathonId: event.id },
  });
  if ((old?.revision ?? 0) !== input.expectedRevision)
    conflict('Judging settings changed. Refresh before saving.');
  if (
    event.status === 'PAUSED' &&
    (await ctx.db.judgingVisit.count({
      where: {
        hackathonId: event.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
    }))
  )
    invalid('Resolve active visits before amending judging.');
  const categories = await ctx.db.judgingCategory.findMany({
    where: { hackathonId: event.id, isEnabled: true },
    include: {
      track: true,
      challenge: true,
      rubric: { include: { criteria: true } },
      judges: {
        where: { isActive: true, user: { isActive: true, role: 'JUDGE' } },
      },
    },
  });
  if (
    categories.length !== input.categories.length ||
    input.categories.some((p) => !categories.some((c) => c.id === p.categoryId))
  )
    invalid('Configure every enabled competition exactly once.');
  const projects = await ctx.db.project.findMany({
    where: { hackathonId: event.id, isActive: true, isDisqualified: false },
    include: {
      challenges: {
        include: { challenge: { include: { allowedTracks: true } } },
      },
      track: true,
      conflicts: true,
      room: true,
    },
  });
  if (projects.some((p) => !p.roomId || !p.room?.isActive))
    invalid('Every eligible project needs an active room.');
  if (
    projects.some((p) =>
      p.challenges.some(
        (e) => !e.challenge.allowedTracks.some((t) => t.trackId === p.trackId),
      ),
    )
  )
    invalid('A challenge entry is not eligible for its project track.');
  const judgeIds = [
    ...new Set(categories.flatMap((c) => c.judges.map((j) => j.userId))),
  ];
  if (
    input.judges.some((j) => !judgeIds.includes(j.judgeId)) ||
    judgeIds.some((id) => !input.judges.some((j) => j.judgeId === id))
  )
    invalid('Set available minutes for every active qualified judge.');
  const policies = input.categories.map((p) => {
    const c = categories.find((c) => c.id === p.categoryId)!;
    const rubric = (c.rubric?.criteria ?? []).map((criterion) => {
      const range = p.criteria.find((r) => r.id === criterion.id);
      return {
        id: criterion.id,
        name: criterion.name,
        description: criterion.description,
        weight: Number(criterion.weight),
        lower: range?.lower ?? 0,
        upper: range?.upper ?? event.scoreScale,
      };
    });
    if (
      new Set(p.criteria.map((r) => r.id)).size !== p.criteria.length ||
      p.criteria.some((r) => !rubric.some((c) => c.id === r.id))
    )
      invalid('Rubric criteria must belong to the selected competition.');
    if (
      c.method === 'RUBRIC' &&
      (!rubric.length || rubric.some((c) => c.weight <= 0))
    )
      invalid('Rubric criteria and weights are required.');
    if (c.method !== 'RUBRIC' && p.criteria.length)
      invalid('Only rubric competitions accept criteria ranges.');
    const projectIds = projects
      .filter(
        (project) =>
          project.track.categoryId === c.id ||
          project.challenges.some((e) => e.challenge.categoryId === c.id),
      )
      .map((p) => p.id)
      .sort();
    if (!projectIds.length)
      invalid('Each enabled competition must have eligible projects.');
    return { ...p, method: c.method, projectIds, rubric };
  });
  // An amendment preserves the scoring method, rubric and eligibility already used by evidence.
  if (old && event.status === 'PAUSED') {
    const previous = old.policy as unknown as JudgingPolicy;
    for (const p of policies) {
      const before = previous.categories.find(
        (c) => c.categoryId === p.categoryId,
      );
      if (
        !before ||
        JSON.stringify([
          before.method,
          before.relativeEstimator,
          before.lambda,
          before.projectIds,
          before.rubric,
        ]) !==
          JSON.stringify([
            p.method,
            p.relativeEstimator,
            p.lambda,
            p.projectIds,
            p.rubric,
          ])
      )
        invalid('Scoring and eligibility cannot change after judging starts.');
    }
  }
  const policy: JudgingPolicy = {
    ...input,
    version: 'CRITIQ_V1',
    setupFingerprint: '',
    ratingLabels: ordinalRatingOptions,
    categories: policies,
  };
  const plan = recommendCoverageTargets({
    ...input,
    projects: projects.map((p) => ({
      id: p.id,
      roomId: p.roomId!,
      competitionIds: policies
        .filter((c) => c.projectIds.includes(p.id))
        .map((c) => c.categoryId),
    })),
    judges: input.judges.map((j) => ({
      id: j.judgeId,
      minutes: j.availableMinutes,
      competitionIds: categories
        .filter((c) => c.judges.some((m) => m.userId === j.judgeId))
        .map((c) => c.id),
      conflictProjectIds: projects
        .filter((p) => p.conflicts.some((c) => c.userId === j.judgeId))
        .map((p) => p.id),
    })),
    competitions: policies.map((c) => ({ ...c, id: c.categoryId })),
  });
  if (event.status === 'PAUSED')
    for (const p of policies) {
      const counts = await ctx.db.evaluation.groupBy({
        by: ['projectId'],
        where: { categoryId: p.categoryId, isExcluded: false },
        _count: true,
      });
      if (counts.some((c) => c._count > p.maximumEvaluations))
        invalid('Maximum coverage cannot be lowered below completed evidence.');
    }
  const revision = (old?.revision ?? 0) + 1;
  await ctx.db.judgingConfiguration.upsert({
    where: { hackathonId: event.id },
    create: {
      hackathonId: event.id,
      revision,
      policy: json(policy),
      plan: json(plan),
    },
    update: { revision, policy: json(policy), plan: json(plan) },
  });
  for (const c of policies)
    await ctx.db.judgingCategory.update({
      where: { id: c.categoryId },
      data: {
        minEvaluations: c.minimumEvaluations,
        maxEvaluations: c.maximumEvaluations,
        targetEvaluations: plan.targets[c.categoryId],
      },
    });
  await ctx.db.hackathon.update({
    where: { id: event.id },
    data: { roomSwitchPercent: input.minRoomCompletionPercent },
  });
  for (const c of policy.categories)
    c.targetEvaluations = plan.targets[c.categoryId];
  policy.setupFingerprint = judgingSetupFingerprint(
    await readSetupSnapshot(ctx),
  );
  await ctx.db.judgingConfiguration.update({
    where: { hackathonId: event.id },
    data: { policy: json(policy) },
  });
  return { revision, plan, policy };
});
