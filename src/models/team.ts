/** Stable identifier for a team within a bracket or season fixture. */
export type TeamId = string;

/** Minimal team identity used when only id and display name matter. */
export interface TeamIdentity {
  id: TeamId;
  name: string;
}

/** Team with a pre-tournament Elo-style rating. */
export interface RatedTeam extends TeamIdentity {
  rating: number;
}

/** Team with an official tournament seed (1 = highest). */
export interface SeededTeam extends RatedTeam {
  seed: number;
}

/**
 * Runtime team used in simulation and bracket logic.
 * Seed is optional because CLI-created teams may lack official seeds.
 */
export interface Team extends RatedTeam {
  /** Official tournament seed when known; otherwise derived from rating ranking. */
  seed?: number;
}

export function isByeTeam(team: Team | null | undefined): boolean {
  return team?.name === "BYE";
}

/** Map a persisted seeded team entry into the runtime team model. */
export function toRuntimeTeam(entry: SeededTeam): Team {
  return {
    id: entry.id,
    name: entry.name,
    rating: entry.rating,
    seed: entry.seed,
  };
}

/** Collect team ids from any collection of id-bearing entries. */
export function teamIdsOf(
  teams: readonly { id: TeamId }[]
): ReadonlySet<TeamId> {
  return new Set(teams.map((team) => team.id));
}

/** Map a runtime team to a persisted entry when an official seed is known. */
export function toSeededTeam(team: Team): SeededTeam | undefined {
  if (team.seed == null) {
    return undefined;
  }

  return {
    id: team.id,
    name: team.name,
    rating: team.rating,
    seed: team.seed,
  };
}
