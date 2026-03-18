import type { SimulationOptions, Team } from "../types.js";

export interface ResolvedMatchupSeeds {
  seedA?: number;
  seedB?: number;
}

export type SeedResolutionOptions = SimulationOptions;

function seedForTeam(
  team: Team,
  options: SeedResolutionOptions
): number | undefined {
  return (
    options.bracketSeeds?.get(team.id) ??
    team.seed
  );
}

/**
 * Resolve tournament seeds for a head-to-head matchup.
 *
 * Explicit `seedA` / `seedB` in options take precedence over `team.seed`
 * and `bracketSeeds`. Returns only seeds that are fully known for both sides.
 */
export function resolveMatchupSeeds(
  teamA: Team,
  teamB: Team,
  options: SeedResolutionOptions = {}
): ResolvedMatchupSeeds {
  const seedA = options.seedA ?? seedForTeam(teamA, options);
  const seedB = options.seedB ?? seedForTeam(teamB, options);

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
  options: SeedResolutionOptions = {}
): SimulationOptions {
  const { seedA, seedB } = resolveMatchupSeeds(teamA, teamB, options);

  if (seedA === undefined || seedB === undefined) {
    return options;
  }

  return { ...options, seedA, seedB };
}
