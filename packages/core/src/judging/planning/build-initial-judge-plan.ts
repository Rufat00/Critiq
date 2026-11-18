import { repairAssignmentPlan } from '../orchestration/repair-assignment-plan';
import { calculateMinRoomVisits } from '../shared/room-stay-math';
import { calculateCoverageDeficits } from '../shared/coverage-math';
import { assertUnique, assertFinite } from '../shared/judging-types';
import type { CoveragePolicy } from '../shared/judging-types';
import { estimateVisitDuration } from './estimate-visit-duration';
export type PlanningProject = {
  id: string;
  roomId: string;
  competitionIds: string[];
};
export type PlanningJudge = {
  id: string;
  minutes: number;
  competitionIds: string[];
  conflictProjectIds: string[];
  stay?: {
    roomId: string;
    reachableProjectIds: string[];
    completedProjectIds: string[];
  };
};
export type PlanningCompetition = CoveragePolicy & {
  id: string;
  formMinutes: number;
};
export type PlanningInput = {
  projects: PlanningProject[];
  judges: PlanningJudge[];
  competitions: PlanningCompetition[];
  presentationMinutes: number;
  questionsMinutes: number;
  travelMinutes: number;
  reservePercent: number;
  minRoomCompletionPercent?: number;
  completedEvaluations?: {
    judgeId: string;
    projectId: string;
    competitionId: string;
  }[];
};
function buildGreedyPlan(
  input: PlanningInput,
  targets: Map<string, number> = new Map(),
) {
  assertUnique(input.projects.map((p) => p.id));
  assertUnique(input.judges.map((j) => j.id));
  assertUnique(input.competitions.map((c) => c.id));
  input.competitions.forEach((c) => calculateCoverageDeficits(0, 0, c));
  input.judges.forEach((j) => {
    assertFinite(j.minutes, 'Judge minutes');
    if (j.minutes < 0) throw new RangeError('Invalid available time.');
  });
  if (
    !Number.isFinite(input.reservePercent) ||
    input.reservePercent < 0 ||
    input.reservePercent > 50 ||
    !Number.isFinite(input.travelMinutes) ||
    input.travelMinutes < 0
  )
    throw new RangeError('Invalid planning reserve or travel time.');
  const stays = new Map<
    string,
    { roomId: string; reachable: string[]; completed: Set<string> }
  >();
  let roomOverrides = 0;
  const remaining = new Map(
    input.judges.map((j) => [
      j.id,
      j.minutes * (1 - input.reservePercent / 100),
    ]),
  );
  const visited = new Set<string>(),
    counts = new Map<string, number>(),
    rooms = new Map<string, string>();
  const key = (p: string, k: string) => JSON.stringify([p, k]);
  for (const e of input.completedEvaluations ?? []) {
    visited.add(key(e.judgeId, e.projectId));
    counts.set(
      key(e.projectId, e.competitionId),
      (counts.get(key(e.projectId, e.competitionId)) ?? 0) + 1,
    );
  }
  for (const j of input.judges)
    if (j.stay) {
      rooms.set(j.id, j.stay.roomId);
      stays.set(j.id, {
        roomId: j.stay.roomId,
        reachable: j.stay.reachableProjectIds,
        completed: new Set(j.stay.completedProjectIds),
      });
    }
  const projectOrder = new Map(
    input.projects.map((project, index) => [project.id, index]),
  );
  const demand = input.projects
    .flatMap((p) =>
      p.competitionIds.map((k) => ({
        p,
        k,
        policy: input.competitions.find((c) => c.id === k)!,
        key: key(p.id, k),
      })),
    )
    .filter((d) => d.policy);
  const quota = (d: (typeof demand)[number]) =>
    targets.get(d.k) ?? d.policy.minimumEvaluations;
  const visits: {
    judgeId: string;
    projectId: string;
    roomId: string;
    competitionIds: string[];
    minutes: number;
  }[] = [];
  // Eligibility changes only when a judge visits this project. Cache it rather
  // than rescanning every judge inside every demand-sort comparison.
  const eligibleJudges = new Map(
    demand.map((d) => [
      d.key,
      new Set(
        input.judges
          .filter(
            (j) =>
              j.competitionIds.includes(d.k) &&
              !j.conflictProjectIds.includes(d.p.id) &&
              !visited.has(key(j.id, d.p.id)),
          )
          .map((j) => j.id),
      ),
    ]),
  );
  const projectDemand = new Map(
    input.projects.map((project) => [
      project.id,
      demand.filter((d) => d.p.id === project.id),
    ]),
  );
  const eligible = (j: PlanningJudge, d: (typeof demand)[number]) =>
    eligibleJudges.get(d.key)!.has(j.id);
  while (true) {
    // Scarce demands and judges first, so generic work does not consume specialists.
    const needs = demand
      .filter((d) => (counts.get(d.key) ?? 0) < quota(d))
      .sort(
        (a, b) =>
          eligibleJudges.get(a.key)!.size - eligibleJudges.get(b.key)!.size ||
          projectOrder.get(a.p.id)! - projectOrder.get(b.p.id)!,
      );
    let assigned = false;
    for (const d of needs) {
      const judges = input.judges
        .filter((j) => eligible(j, d))
        .sort(
          (a, b) =>
            a.competitionIds.length - b.competitionIds.length ||
            remaining.get(b.id)! - remaining.get(a.id)!,
        );
      for (const j of judges) {
        const categories = needs
          .filter((x) => x.p.id === d.p.id && j.competitionIds.includes(x.k))
          .map((x) => x.k);
        const minutes =
          estimateVisitDuration(
            input.presentationMinutes,
            input.questionsMinutes,
            categories.map(
              (k) => input.competitions.find((c) => c.id === k)!.formMinutes,
            ),
          ) +
          (rooms.get(j.id) && rooms.get(j.id) !== d.p.roomId
            ? input.travelMinutes
            : 0);
        if (minutes > remaining.get(j.id)!) continue;
        const stay = stays.get(j.id);
        if (
          stay &&
          stay.roomId !== d.p.roomId &&
          stay.completed.size <
            calculateMinRoomVisits(
              input.minRoomCompletionPercent ?? 25,
              stay.reachable.length,
            )
        ) {
          const local = needs.some(
            (x) =>
              x.p.roomId === stay.roomId &&
              eligible(j, x) &&
              estimateVisitDuration(
                input.presentationMinutes,
                input.questionsMinutes,
                [x.policy.formMinutes],
              ) <= remaining.get(j.id)!,
          );
          if (local) continue;
          roomOverrides++;
        }
        if (!stay || stay.roomId !== d.p.roomId)
          stays.set(j.id, {
            roomId: d.p.roomId,
            reachable: input.projects
              .filter(
                (p) =>
                  p.roomId === d.p.roomId &&
                  !visited.has(key(j.id, p.id)) &&
                  !j.conflictProjectIds.includes(p.id) &&
                  p.competitionIds.some((k) => j.competitionIds.includes(k)),
              )
              .map((p) => p.id),
            completed: new Set(),
          });
        stays.get(j.id)!.completed.add(d.p.id);
        visits.push({
          judgeId: j.id,
          projectId: d.p.id,
          roomId: d.p.roomId,
          competitionIds: categories,
          minutes,
        });
        remaining.set(j.id, remaining.get(j.id)! - minutes);
        rooms.set(j.id, d.p.roomId);
        visited.add(key(j.id, d.p.id));
        for (const related of projectDemand.get(d.p.id)!)
          eligibleJudges.get(related.key)!.delete(j.id);
        for (const k of categories)
          counts.set(key(d.p.id, k), (counts.get(key(d.p.id, k)) ?? 0) + 1);
        assigned = true;
        break;
      }
      if (assigned) break;
    }
    if (!assigned) break;
  }
  const unmetMinimums = demand.flatMap((d) => {
    const deficit = d.policy.minimumEvaluations - (counts.get(d.key) ?? 0);
    return deficit > 0
      ? [{ competitionId: d.k, projectId: d.p.id, deficit }]
      : [];
  });
  const unmetTargets = demand.flatMap((d) => {
    const deficit = quota(d) - (counts.get(d.key) ?? 0);
    return deficit > 0
      ? [{ competitionId: d.k, projectId: d.p.id, deficit }]
      : [];
  });
  return {
    feasible: unmetMinimums.length === 0,
    guaranteed: false,
    roomOverrides,
    visits,
    unmetMinimums,
    unmetTargets,
    quotas: demand.map((d) => ({
      competitionId: d.k,
      projectId: d.p.id,
      planned: counts.get(d.key) ?? 0,
    })),
    judgeLoad: input.judges.map((j) => ({
      judgeId: j.id,
      usedMinutes:
        j.minutes * (1 - input.reservePercent / 100) - remaining.get(j.id)!,
      slackMinutes: remaining.get(j.id)!,
    })),
    warnings: [
      'Heuristic estimate includes shared presentation, room stays with safe overrides, and travel; delays and future availability can reduce capacity.',
    ],
  };
}

export function buildInitialJudgePlan(
  input: PlanningInput,
  targets: Map<string, number> = new Map(),
) {
  return repairAssignmentPlan(input, (variant) =>
    buildGreedyPlan(variant, targets),
  );
}
