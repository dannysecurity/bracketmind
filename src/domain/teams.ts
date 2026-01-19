import type { Team } from "../types.js";
import { isByeTeam } from "../types.js";
import type { SeasonDocument } from "../season/types.js";
import type { BracketOrdering } from "./types.js";

/** JSON fixture team entry; required seed distinguishes persisted from CLI teams. */
export interface SeasonTeamEntry {
  id: string;
  name: string;
  seed: number;
  rating: number;
}

/** Convert a season fixture team entry into the runtime team model. */
export function seasonTeamToTeam(entry: SeasonTeamEntry): Team {
  return {
    id: entry.id,
    name: entry.name,
    rating: entry.rating,
    seed: entry.seed,
  };
}

export function teamsFromDocument(doc: SeasonDocument): Team[] {
  return doc.teams.map(seasonTeamToTeam);
}

export function teamMapFromDocument(doc: SeasonDocument): Map<string, Team> {
  return new Map(teamsFromDocument(doc).map((team) => [team.id, team]));
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
