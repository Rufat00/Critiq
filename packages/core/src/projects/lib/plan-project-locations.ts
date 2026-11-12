export type PlacementProject = { id: string; trackId: string };
export type PlacementRoom = {
  roomId: string;
  trackId: string;
  capacity: number;
};
export type ProjectLocation = {
  id: string;
  roomId: string | null;
  tableNumber: number | null;
};

// Projects arrive in registration order; rooms arrive in configured placement order.
// Fill capacities first, then number each room as one consecutive block.
export function planProjectLocations(
  projects: PlacementProject[],
  rooms: PlacementRoom[],
): ProjectLocation[] {
  const remaining = rooms.map((room) => ({ ...room }));
  const byRoom = new Map<string, ProjectLocation[]>();
  for (const room of rooms) {
    if (!byRoom.has(room.roomId)) byRoom.set(room.roomId, []);
  }
  const locations = projects.map((project): ProjectLocation => {
    const room = remaining.find(
      (room) => room.trackId === project.trackId && room.capacity > 0,
    );
    if (!room) return { id: project.id, roomId: null, tableNumber: null };
    room.capacity--;
    const location = { id: project.id, roomId: room.roomId, tableNumber: null };
    byRoom.get(room.roomId)!.push(location);
    return location;
  });
  let number = 0;
  for (const roomProjects of byRoom.values()) {
    for (const location of roomProjects) location.tableNumber = ++number;
  }
  return locations;
}
