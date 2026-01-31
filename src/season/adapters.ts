import { Season } from "../models/season.js";
import type { Team } from "../models/index.js";
import type { SeasonDocument } from "./types.js";

export { toRuntimeTeam as seasonTeamToTeam } from "../models/team.js";

/** Build a composed season model from a validated document. */
export function seasonFromDocument(doc: SeasonDocument): Season {
  return Season.fromDocument(doc);
}

export function teamRegistryFromDocument(doc: SeasonDocument) {
  return seasonFromDocument(doc).registry;
}

export function teamsFromDocument(doc: SeasonDocument): Team[] {
  return seasonFromDocument(doc).toRuntimeTeams();
}

export function teamMapFromDocument(doc: SeasonDocument): Map<string, Team> {
  return new Map(seasonFromDocument(doc).registry.asMap());
}
