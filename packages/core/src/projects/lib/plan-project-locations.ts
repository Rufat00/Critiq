export type PlacementProject = { id: string; trackId: string };
export type PlacementRoom = {
  roomId: string;
  trackId: string;
  tableRanges: { fromNumber: number; toNumber: number }[];
};
export type ProjectLocation = {
  id: string;
  roomId: string | null;
  tableNumber: number | null;
};

// Inputs are already in database registration order and configured room order.
// Ranges are merged so sparse or overlapping definitions never expand into huge arrays.
export function planProjectLocations(
  projects: PlacementProject[],
  rooms: PlacementRoom[],
): ProjectLocation[] {
  function* tables(trackId: string) {
    for (const room of rooms) {
      if (room.trackId !== trackId) continue;
      let previousEnd = -1;
      for (const range of [...room.tableRanges].sort(
        (a, b) => a.fromNumber - b.fromNumber || a.toNumber - b.toNumber,
      )) {
        for (
          let tableNumber = Math.max(range.fromNumber, previousEnd + 1);
          tableNumber <= range.toNumber;
          tableNumber++
        ) {
          yield { roomId: room.roomId, tableNumber };
        }
        previousEnd = Math.max(previousEnd, range.toNumber);
      }
    }
  }
  const cursors = new Map<string, ReturnType<typeof tables>>();
  const occupied = new Map<string, Set<number>>();
  return projects.map((project) => {
    let cursor = cursors.get(project.trackId);
    if (!cursor) {
      cursor = tables(project.trackId);
      cursors.set(project.trackId, cursor);
    }
    while (true) {
      const next = cursor.next();
      if (next.done) break;
      const slot = next.value;
      let used = occupied.get(slot.roomId);
      if (!used) {
        used = new Set();
        occupied.set(slot.roomId, used);
      }
      if (used.has(slot.tableNumber)) continue;
      used.add(slot.tableNumber);
      return { id: project.id, ...slot };
    }
    return { id: project.id, roomId: null, tableNumber: null };
  });
}
