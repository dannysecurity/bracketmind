import type { Team } from "../types.js";

export interface SeededTeam {
  seed: number;
  team: Team;
}

/** Map each real team's id to its tournament seed (1 = highest rated). */
export function buildSeedMap(teams: Team[]): Map<string, number> {
  const realTeams = teams.filter((team) => team.name !== "BYE");
  const ranked = [...realTeams].sort((a, b) => b.rating - a.rating);
  const seeds = new Map<string, number>();
  ranked.forEach((team, index) => {
    seeds.set(team.id, index + 1);
  });
  return seeds;
}

/** Rank teams by rating and assign tournament seeds (1 = highest rated). */
export function buildSeededTeams(teams: Team[]): SeededTeam[] {
  const realTeams = teams.filter((team) => team.name !== "BYE");
  const ranked = [...realTeams].sort((a, b) => b.rating - a.rating);
  return ranked.map((team, index) => ({
    seed: index + 1,
    team,
  }));
}
