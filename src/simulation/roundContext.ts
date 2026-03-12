const DEFAULT_TOTAL_ROUNDS = 4;

/**
 * Resolve round context for standalone game simulation.
 * When only `round` is given, assumes a four-round NCAA-style bracket.
 * When only `totalRounds` is given, treats the game as the championship round.
 */
export function resolveSimulationRoundContext(
  round?: number,
  totalRounds?: number
): { round: number; totalRounds: number } | undefined {
  if (round === undefined && totalRounds === undefined) {
    return undefined;
  }

  if (round !== undefined && totalRounds !== undefined) {
    return { round, totalRounds };
  }

  if (round !== undefined) {
    return { round, totalRounds: DEFAULT_TOTAL_ROUNDS };
  }

  return { round: totalRounds! - 1, totalRounds: totalRounds! };
}
