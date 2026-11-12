export function roomSearchWhere(hackathonId: string, search: string) {
  return {
    hackathonId,
    ...(search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {}),
  };
}
