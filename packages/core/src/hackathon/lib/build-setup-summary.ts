import { fingerprint, type SetupSnapshot } from './read-setup-snapshot';

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
    if (
      (category.kind === 'CHALLENGE' && category.method === 'RELATIVE') ||
      (category.kind !== 'CHALLENGE' && category.method === 'RATING_SCALE')
    )
      blockers.push(
        `${category.name}: choose a judging method supported by this category.`,
      );
    const eligible = projects.filter((p) => {
      if (category.kind === 'CHALLENGE')
        return p.challenges.some(
          (entry) => entry.challengeId === category.challenge?.id,
        );
      return category.track?.id === p.trackId;
    });
    // Overall has no judging work when every project belongs to a specialized track.
    if (category.kind === 'OVERALL' && !eligible.length) continue;
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
      `${missingLocations} project${missingLocations === 1 ? ' needs' : 's need'} a room or table location.`,
    );
  const names = new Map<string, number>();
  for (const p of projects) {
    const key = p.name.trim().replace(/\s+/g, ' ').toLowerCase();
    names.set(key, (names.get(key) ?? 0) + 1);
    if (!key) blockers.push('A project is missing its name.');
    if (p.roomId && !h.rooms.some((r) => r.id === p.roomId && r.isActive))
      blockers.push(`${p.name}: choose an active room in this hackathon.`);
    if (!h.categories.some((c) => c.track?.id === p.trackId))
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
        !category.challenge.allowedTracks.some((t) => t.trackId === p.trackId)
      )
        blockers.push(`${p.name}: track is not eligible for ${category.name}.`);
    }
    if (p.roomId && p.tableNumber !== null) {
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
  return {
    id: h.id,
    name: h.name,
    status: h.status,
    scoreScale: h.scoreScale,
    blockers,
    warnings,
    fingerprint: fingerprint({
      name: h.name,
      scoreScale: h.scoreScale,
      roomSwitchPercent: h.roomSwitchPercent,
      categories: h.categories,
      projects: h.projects,
      rooms: h.rooms,
      invitations: h.invitations,
      judges,
      blockers,
      warnings,
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
