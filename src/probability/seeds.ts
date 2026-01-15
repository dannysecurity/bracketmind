import { isByeTeam, type Team } from "../types.js";

export interface SeededTeam {
  seed: number;
  team: Team;
}

/** Map each real team's id to its tournament seed (1 = highest rated). */
export function buildSeedMap(teams: Team[]): Map<string, number> {
  const realTeams = teams.filter((team) => !isByeTeam(team));
  const hasOfficialSeeds = realTeams.some((team) => team.seed !== undefined);
  const seeds = new Map<string, number>();

  if (hasOfficialSeeds) {
    for (const team of realTeams) {
      if (team.seed !== undefined) {
        seeds.set(team.id, team.seed);
      }
    }
    return seeds;
  }

  const ranked = [...realTeams].sort((a, b) => b.rating - a.rating);
  ranked.forEach((team, index) => {
    seeds.set(team.id, index + 1);
  });
  return seeds;
}

/** Rank teams and assign tournament seeds (1 = highest rated or official seed). */
export function buildSeededTeams(teams: Team[]): SeededTeam[] {
  const realTeams = teams.filter((team) => !isByeTeam(team));
  const hasOfficialSeeds = realTeams.some((team) => team.seed !== undefined);

  if (hasOfficialSeeds) {
    return [...realTeams]
      .sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity))
      .map((team) => ({ seed: team.seed!, team }));
  }

  const ranked = [...realTeams].sort((a, b) => b.rating - a.rating);
  return ranked.map((team, index) => ({
    seed: index + 1,
    team,
  }));
}
