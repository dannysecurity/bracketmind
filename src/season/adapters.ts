import type { Team } from "../models/index.js";
import { TeamRegistry } from "../models/registry.js";
import { toRuntimeTeam } from "../models/team.js";
import type { SeasonDocument } from "./types.js";

export { toRuntimeTeam as seasonTeamToTeam } from "../models/team.js";

export function teamRegistryFromDocument(doc: SeasonDocument): TeamRegistry {
  return TeamRegistry.fromSeededTeams(doc.teams);
}

export function teamsFromDocument(doc: SeasonDocument): Team[] {
  return teamRegistryFromDocument(doc).toArray();
}

export function teamMapFromDocument(doc: SeasonDocument): Map<string, Team> {
  return new Map(teamRegistryFromDocument(doc).asMap());
}
