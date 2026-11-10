import type { TableRange } from './table-ranges';

export function getTableRangePreview(
  tracks: { trackId: string; ranges: TableRange[] }[],
  page = 0,
) {
  const ranges = tracks
    .flatMap((track, index) =>
      track.ranges.map((range) => ({
        ...range,
        trackId: track.trackId,
        index,
      })),
    )
    .sort((a, b) => a.fromNumber - b.fromNumber);
  const total = ranges.reduce(
    (count, range) => count + range.toNumber - range.fromNumber + 1,
    0,
  );
  const current = Math.min(page, Math.max(0, Math.ceil(total / 100) - 1));
  const offset = current * 100;
  const tables: { table: number; trackId: string; index: number }[] = [];
  let skipped = 0;
  for (const range of ranges) {
    const length = range.toNumber - range.fromNumber + 1;
    const start = Math.max(0, offset - skipped);
    for (let i = start; i < length && tables.length < 100; i++) {
      tables.push({
        table: range.fromNumber + i,
        trackId: range.trackId,
        index: range.index,
      });
    }
    skipped += length;
    if (tables.length === 100) break;
  }
  return { total, current, offset, tables };
}
