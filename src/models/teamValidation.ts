import type { SeededTeam } from "./team.js";

/** Ensure team ids are unique within a fixture. */
export function validateUniqueTeamIds(teams: readonly SeededTeam[]): void {
  const ids = new Set<string>();
  for (const team of teams) {
    if (ids.has(team.id)) {
      throw new Error(`Duplicate team id "${team.id}"`);
    }
    ids.add(team.id);
  }
}

/** Ensure seeds are consecutive integers from 1 through team count. */
export function validateConsecutiveSeeds(teams: readonly SeededTeam[]): void {
  const seeds = teams.map((team) => team.seed).sort((a, b) => a - b);
  for (let i = 0; i < seeds.length; i++) {
    if (seeds[i] !== i + 1) {
      throw new Error(
        `Team seeds must be consecutive integers from 1 to ${teams.length}`
      );
    }
  }
}

/** Validate seeded team entries for season fixtures. */
export function validateSeededTeams(teams: readonly SeededTeam[]): void {
  validateUniqueTeamIds(teams);
  validateConsecutiveSeeds(teams);
}
