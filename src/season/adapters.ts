import type { Team } from "../types.js";
import type { SeasonDocument, SeasonTeam } from "./types.js";

/** Convert a season fixture team entry into the runtime team model. */
export function seasonTeamToTeam(entry: SeasonTeam): Team {
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
