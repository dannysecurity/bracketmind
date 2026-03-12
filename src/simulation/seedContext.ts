import type { SimulationOptions, Team } from "../types.js";

export interface ResolvedMatchupSeeds {
  seedA?: number;
  seedB?: number;
}

/**
 * Resolve tournament seeds for a head-to-head matchup.
 *
 * Explicit `seedA` / `seedB` in options take precedence over `team.seed`.
 * Returns only seeds that are fully known for both sides.
 */
export function resolveMatchupSeeds(
  teamA: Team,
  teamB: Team,
  options: SimulationOptions = {}
): ResolvedMatchupSeeds {
  const seedA = options.seedA ?? teamA.seed;
  const seedB = options.seedB ?? teamB.seed;

  if (seedA === undefined || seedB === undefined) {
    return {};
  }

  return { seedA, seedB };
}

/**
 * Merge resolved seeds into simulation options without mutating the input.
 */
export function withResolvedSeeds(
  teamA: Team,
  teamB: Team,
  options: SimulationOptions = {}
): SimulationOptions {
  const { seedA, seedB } = resolveMatchupSeeds(teamA, teamB, options);

  if (seedA === undefined || seedB === undefined) {
    return options;
  }

  return { ...options, seedA, seedB };
}
