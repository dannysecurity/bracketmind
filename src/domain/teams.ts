import type { SeededTeam, Team } from "../models/index.js";
import { isByeTeam } from "../models/index.js";
import type { BracketOrdering } from "./types.js";

/** Convert a season fixture team entry into the runtime team model. */
export function seasonTeamToTeam(entry: SeededTeam): Team {
  return {
    id: entry.id,
    name: entry.name,
    rating: entry.rating,
    seed: entry.seed,
  };
}

/** Sort teams for bracket seeding using the chosen ordering strategy. */
export function orderTeamsForBracket(
  teams: Team[],
  ordering: BracketOrdering
): Team[] {
  const realTeams = teams.filter((team) => !isByeTeam(team));

  if (ordering === "seed") {
    return [...realTeams].sort((a, b) => {
      const seedA = a.seed ?? Number.MAX_SAFE_INTEGER;
      const seedB = b.seed ?? Number.MAX_SAFE_INTEGER;
      return seedA - seedB;
    });
  }

  return [...realTeams].sort((a, b) => b.rating - a.rating);
}
