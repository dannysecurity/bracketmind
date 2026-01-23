import type { Team } from "../models/index.js";
import { seasonTeamToTeam } from "../domain/teams.js";
import type { SeasonDocument } from "./types.js";

export { seasonTeamToTeam } from "../domain/teams.js";

export function teamsFromDocument(doc: SeasonDocument): Team[] {
  return doc.teams.map(seasonTeamToTeam);
}

export function teamMapFromDocument(doc: SeasonDocument): Map<string, Team> {
  return new Map(teamsFromDocument(doc).map((team) => [team.id, team]));
}
