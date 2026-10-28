export type TableRange = { fromNumber: number; toNumber: number };

// Count the union without expanding potentially large or overlapping ranges.
export function countCoveredTables(ranges: TableRange[]) {
  const sorted = [...ranges].sort((a, b) => a.fromNumber - b.fromNumber);
  let end = 0;
  let total = 0;
  for (const range of sorted) {
    total += Math.max(
      0,
      range.toNumber - Math.max(end + 1, range.fromNumber) + 1,
    );
    end = Math.max(end, range.toNumber);
  }
  return total;
}

export function constrainTableRange(
  next: TableRange,
  previous: TableRange,
  others: TableRange[],
  capacity: number,
): TableRange {
  if (countCoveredTables([...others, next]) <= capacity) return next;
  if (next.fromNumber !== previous.fromNumber) {
    let low = next.fromNumber,
      high = next.toNumber;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (
        countCoveredTables([
          ...others,
          { fromNumber: middle, toNumber: next.toNumber },
        ]) <= capacity
      )
        high = middle;
      else low = middle + 1;
    }
    return { fromNumber: low, toNumber: next.toNumber };
  }
  let low = next.fromNumber,
    high = next.toNumber;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (
      countCoveredTables([
        ...others,
        { fromNumber: next.fromNumber, toNumber: middle },
      ]) <= capacity
    )
      low = middle;
    else high = middle - 1;
  }
  return { fromNumber: next.fromNumber, toNumber: low };
}
