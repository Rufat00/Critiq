type CategoryAccess = {
  id: string;
  kind: string;
  track: { id: string } | null;
  challenge: { allowedTracks: { trackId: string }[] } | null;
  judges: { userId: string; categoryId: string }[];
};
// A judge's track access also covers challenges open to that track. Explicit
// challenge qualifications remain available for dedicated challenge judges.
export function resolveCategoryJudges<T extends CategoryAccess>(
  categories: T[],
): T[] {
  return categories.map((category) => {
    if (category.kind !== 'CHALLENGE' || !category.challenge) return category;
    const tracks = new Set(
      category.challenge.allowedTracks.map((t) => t.trackId),
    );
    const judges = new Map(
      category.judges.map((judge) => [judge.userId, judge]),
    );
    for (const track of categories) {
      if (!track.track || !tracks.has(track.track.id)) continue;
      for (const judge of track.judges)
        if (!judges.has(judge.userId))
          judges.set(judge.userId, { ...judge, categoryId: category.id });
    }
    return { ...category, judges: [...judges.values()] };
  });
}
