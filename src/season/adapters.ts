import { Season } from "../models/season.js";
import type { Team } from "../models/index.js";
import { resolveSeason } from "./resolveSeason.js";
import type { SeasonDocument } from "./types.js";

export { toRuntimeTeam as seasonTeamToTeam } from "../models/team.js";

/** Build a composed season model from a validated document. */
export function seasonFromDocument(doc: SeasonDocument): Season {
  return Season.fromDocument(doc);
}

export function teamRegistryFromDocument(doc: SeasonDocument | Season) {
  return resolveSeason(doc).registry;
}

export function teamsFromDocument(doc: SeasonDocument | Season): Team[] {
  return resolveSeason(doc).toRuntimeTeams();
}

export function teamMapFromDocument(
  doc: SeasonDocument | Season
): Map<string, Team> {
  return new Map(resolveSeason(doc).registry.asMap());
}
