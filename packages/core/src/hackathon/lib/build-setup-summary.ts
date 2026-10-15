import { fingerprint, type SetupSnapshot } from './read-setup-snapshot';
import type { SetupSection } from '../schemas/setup-completion-schema';

export function buildSetupSummary({ hackathon: h, judges }: SetupSnapshot) {
  const projects = h.projects.filter((p) => p.isActive && !p.isDisqualified);
  const activeJudges = judges.filter((j) => j.isActive);
  const enabledCategories = h.categories.filter((c) => c.isEnabled);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!h.name?.trim()) blockers.push('Add your hackathon name.');
  if (!enabledCategories.some((c) => c.kind === 'OVERALL'))
    blockers.push('Configure an enabled overall judging category.');
  if (!projects.length) blockers.push('Add at least one active project.');
  if (!activeJudges.length)
    blockers.push(
      'Add at least one active judge account. Invitations alone are not enough.',
    );
  if (![5, 10].includes(h.scoreScale))
    blockers.push('Choose a score scale of 5 or 10.');

  for (const category of enabledCategories) {
    const eligible = projects.filter((p) => {
      if (category.kind === 'TRACK') return category.track?.id === p.trackId;
      if (category.kind === 'CHALLENGE')
        return p.challenges.some(
          (entry) => entry.challengeId === category.challenge?.id,
        );
      return true; // Winner eligibility is separate from Overall evaluation eligibility.
    });
    const assigned = activeJudges.filter((j) =>
      category.judges.some((m) => m.userId === j.id && m.isActive),
    );
    if (!eligible.length)
      blockers.push(
        `${category.name}: no eligible projects. Disable this category or add projects.`,
      );
    if (!assigned.length)
      blockers.push(`${category.name}: no active judges with category access.`);
    if (category.method === 'RUBRIC' && !category.rubric?.criteria.length)
      blockers.push(`${category.name}: add at least one rubric criterion.`);
    if (
      eligible.some(
        (p) =>
          assigned.length > 0 &&
          assigned.every((j) => j.conflicts.some((c) => c.projectId === p.id)),
      )
    )
      blockers.push(
        `${category.name}: a project has conflicts with every assigned judge.`,
      );
  }
  const missingLocations = projects.filter(
    (p) => !p.roomId || p.tableNumber === null,
  ).length;
  if (missingLocations)
    warnings.push(
      `${missingLocations} project${missingLocations === 1 ? '' : 's'} need a room or table location.`,
    );
  const names = new Map<string, number>();
  for (const p of projects) {
    const key = p.name.trim().replace(/\s+/g, ' ').toLowerCase();
    names.set(key, (names.get(key) ?? 0) + 1);
    if (!key) blockers.push('A project is missing its name.');
    if (p.roomId && !h.rooms.some((r) => r.id === p.roomId && r.isActive))
      blockers.push(`${p.name}: choose an active room in this hackathon.`);
    if (p.trackId && !h.categories.some((c) => c.track?.id === p.trackId))
      blockers.push(`${p.name}: track does not belong to this hackathon.`);
    for (const entry of p.challenges) {
      const category = h.categories.find(
        (c) => c.challenge?.id === entry.challengeId,
      );
      if (!category?.challenge)
        blockers.push(
          `${p.name}: challenge does not belong to this hackathon.`,
        );
      else if (
        category.challenge.allowedTracks.length &&
        !category.challenge.allowedTracks.some((t) => t.trackId === p.trackId)
      )
        blockers.push(`${p.name}: track is not eligible for ${category.name}.`);
    }
    if (p.roomId && p.tableNumber !== null && p.trackId) {
      const room = h.rooms.find((r) => r.id === p.roomId);
      const trackRoom = room?.trackRooms.find(
        (r) => r.trackId === p.trackId && r.isActive,
      );
      if (
        !trackRoom ||
        !trackRoom.tableRanges.some(
          (r) => p.tableNumber! >= r.fromNumber && p.tableNumber! <= r.toNumber,
        )
      )
        blockers.push(
          `${p.name}: table is outside the configured track room ranges.`,
        );
    }
  }
  const duplicateNames = [...names.values()].filter(
    (count) => count > 1,
  ).length;
  if (duplicateNames)
    warnings.push(
      `${duplicateNames} project name${duplicateNames === 1 ? ' appears' : 's appear'} more than once. Check for duplicates.`,
    );
  const customCategoryCount = h.categories.filter(
    (category) => category.kind !== 'OVERALL',
  ).length;
  const activeRooms = h.rooms.filter((room) => room.isActive);
  const sections: {
    id: SetupSection;
    title: string;
    description: string;
    count: number | null;
    canComplete: boolean;
    href: string;
    done: boolean;
    fingerprint: string;
  }[] = [
    {
      id: 'event',
      title: 'Create your event',
      description: 'Name your hackathon to create its judging workspace.',
      count: null,
      canComplete: Boolean(h.name?.trim()),
      href: '/admin/settings',
      fingerprint: fingerprint({ name: h.name, scoreScale: h.scoreScale }),
      done: false,
    },
    {
      id: 'categories',
      title: 'Judging categories',
      description:
        'Set up overall judging, with optional tracks and challenges.',
      count: customCategoryCount,
      canComplete: customCategoryCount > 0,
      href: '/admin/categories',
      fingerprint: fingerprint({ categories: h.categories, rooms: h.rooms }),
      done: false,
    },
    {
      id: 'projects',
      title: 'Projects',
      description:
        'Prepare the projects, category entries, and presentation locations.',
      count: projects.length,
      canComplete: projects.length > 0,
      href: '/admin/projects',
      fingerprint: fingerprint({
        projects: h.projects,
        categories: h.categories,
        rooms: h.rooms,
      }),
      done: false,
    },
    {
      id: 'judges',
      title: 'Judges',
      description:
        'Prepare judge accounts and give them access to their categories.',
      count: activeJudges.length,
      canComplete: activeJudges.length > 0,
      href: '/admin/judges',
      fingerprint: fingerprint({
        judges,
        categories: h.categories,
        invitations: h.invitations,
      }),
      done: false,
    },
    {
      id: 'rooms',
      title: 'Rooms',
      description:
        'Set up presentation rooms and table locations for your projects.',
      count: activeRooms.length,
      canComplete: activeRooms.length > 0,
      href: '/admin/rooms',
      fingerprint: fingerprint({ rooms: h.rooms }),
      done: false,
    },
  ];
  for (const section of sections)
    section.done =
      section.canComplete &&
      (section.id === 'event' ||
        h.setupCompletions.some(
          (completion) =>
            completion.section === section.id &&
            completion.fingerprint === section.fingerprint,
        ));
  const completeCount = sections.filter((section) => section.done).length;
  const completionWarnings = sections
    .filter(
      (section) =>
        !section.done && (section.id !== 'categories' || section.canComplete),
    )
    .map((section) => `${section.title} setup has not been marked as done.`);
  const allWarnings = [...warnings, ...completionWarnings];
  return {
    id: h.id,
    name: h.name,
    status: h.status,
    scoreScale: h.scoreScale,
    sections,
    completeCount,
    totalCount: 5,
    progress: Math.round((completeCount / 5) * 100),
    blockers,
    warnings: allWarnings,
    fingerprint: fingerprint({
      sections: sections.map((s) => ({
        fingerprint: s.fingerprint,
        done: s.done,
      })),
      blockers,
      warnings: allWarnings,
    }),
    counts: {
      projects: projects.length,
      judges: activeJudges.length,
      categories: customCategoryCount,
      tracks: h.categories.filter((c) => c.kind === 'TRACK').length,
      challenges: h.categories.filter((c) => c.kind === 'CHALLENGE').length,
      rooms: activeRooms.length,
      invitations: h.invitations.filter(
        (i) =>
          i.status === 'ACTIVE' &&
          i.expiresAt > new Date() &&
          i.usedCount < i.maxUses,
      ).length,
    },
    categories: h.categories.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      method: c.method,
      enabled: c.isEnabled,
      criteria: c.rubric?.criteria.length ?? 0,
      minEvaluations: c.minEvaluations,
      targetEvaluations: c.targetEvaluations,
      timerSeconds: c.timerSeconds,
    })),
  };
}
export type HackathonSetupSummary = ReturnType<typeof buildSetupSummary>;
