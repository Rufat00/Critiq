const colors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

// Use the full track list so a track has the same color in every room.
export function getTrackColor(trackId: string, tracks: { id: string }[]) {
  const index = Math.max(
    0,
    tracks.findIndex((track) => track.id === trackId),
  );
  return colors[index % colors.length]!;
}
