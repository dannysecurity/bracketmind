import type { SeededTeam, Team, TeamId } from "./team.js";
import { toRuntimeTeam } from "./team.js";

/**
 * Indexed lookup for teams referenced by id in recorded games and season fixtures.
 * Centralizes duplicate-id validation and seed resolution.
 */
export class TeamRegistry {
  private readonly teams: Map<TeamId, Team>;
  private readonly seeds: Map<TeamId, number>;

  private constructor(teams: Map<TeamId, Team>, seeds: Map<TeamId, number>) {
    this.teams = teams;
    this.seeds = seeds;
  }

  static fromTeams(teams: readonly Team[]): TeamRegistry {
    const map = new Map<TeamId, Team>();
    const seeds = new Map<TeamId, number>();

    for (const team of teams) {
      if (map.has(team.id)) {
        throw new Error(`Duplicate team id: ${team.id}`);
      }
      map.set(team.id, team);
      if (team.seed != null) {
        seeds.set(team.id, team.seed);
      }
    }

    return new TeamRegistry(map, seeds);
  }

  static fromSeededTeams(entries: readonly SeededTeam[]): TeamRegistry {
    return TeamRegistry.fromTeams(entries.map(toRuntimeTeam));
  }

  get(id: TeamId): Team | undefined {
    return this.teams.get(id);
  }

  require(id: TeamId): Team {
    const team = this.teams.get(id);
    if (!team) {
      throw new Error(`Unknown team id: ${id}`);
    }
    return team;
  }

  has(id: TeamId): boolean {
    return this.teams.has(id);
  }

  /** Official tournament seed when known. */
  seedOf(id: TeamId): number | undefined {
    return this.seeds.get(id);
  }

  requireSeed(id: TeamId): number {
    const seed = this.seeds.get(id);
    if (seed == null) {
      throw new Error(`No official seed for team id: ${id}`);
    }
    return seed;
  }

  entries(): IterableIterator<Team> {
    return this.teams.values();
  }

  toArray(): Team[] {
    return [...this.teams.values()];
  }

  /** Expose the underlying id map for legacy call sites. */
  asMap(): ReadonlyMap<TeamId, Team> {
    return this.teams;
  }
}
