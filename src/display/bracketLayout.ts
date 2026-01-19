/** Vertical placement of a match within an ASCII or CSS bracket grid. */
export interface MatchExtents {
  top: number;
  bottom: number;
  mid: number;
}

/** Compute row extents for a match in a single-elimination tree layout. */
export function matchExtents(round: number, slot: number, totalRounds: number): MatchExtents {
  if (round === 0) {
    const top = slot * 2;
    return { top, bottom: top + 1, mid: top + 0.5 };
  }

  const upper = matchExtents(round - 1, slot * 2, totalRounds);
  const lower = matchExtents(round - 1, slot * 2 + 1, totalRounds);
  return {
    top: upper.top,
    bottom: lower.bottom,
    mid: (upper.mid + lower.mid) / 2,
  };
}

/** Map a fractional row coordinate to an integer grid row index. */
export function displayRow(mid: number): number {
  return Math.round(mid * 2);
}

/** Total grid rows needed to render every match in a bracket view. */
export function bracketGridRowCount(rounds: number, firstRoundMatchCount: number): number {
  let maxRow = 0;
  for (let round = 0; round < rounds; round++) {
    const slots = firstRoundMatchCount / Math.pow(2, round);
    for (let slot = 0; slot < slots; slot++) {
      const { mid } = matchExtents(round, slot, rounds);
      maxRow = Math.max(maxRow, displayRow(mid));
    }
  }
  return maxRow + 1;
}
