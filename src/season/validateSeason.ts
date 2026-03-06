import type { RecordedGame, SeededTeam } from "../models/index.js";
import { validateRecordedGames } from "../models/gameValidation.js";
import { teamIdsOf } from "../models/team.js";
import { validateSeededTeams } from "../models/teamValidation.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(obj: Record<string, unknown>, key: string, label: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label}: "${key}" must be a non-empty string`);
  }
  return value;
}

function requireNumber(obj: Record<string, unknown>, key: string, label: string): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}: "${key}" must be a finite number`);
  }
  return value;
}

function parseTeam(raw: unknown, index: number): SeededTeam {
  if (!isRecord(raw)) {
    throw new Error(`teams[${index}] must be an object`);
  }

  return {
    id: requireString(raw, "id", `teams[${index}]`),
    name: requireString(raw, "name", `teams[${index}]`),
    seed: requireNumber(raw, "seed", `teams[${index}]`),
    rating: requireNumber(raw, "rating", `teams[${index}]`),
  };
}

function parseGame(raw: unknown, index: number): RecordedGame {
  if (!isRecord(raw)) {
    throw new Error(`games[${index}] must be an object`);
  }

  return {
    round: requireNumber(raw, "round", `games[${index}]`),
    slot: requireNumber(raw, "slot", `games[${index}]`),
    teamAId: requireString(raw, "teamAId", `games[${index}]`),
    teamBId: requireString(raw, "teamBId", `games[${index}]`),
    scoreA: requireNumber(raw, "scoreA", `games[${index}]`),
    scoreB: requireNumber(raw, "scoreB", `games[${index}]`),
    winnerId: requireString(raw, "winnerId", `games[${index}]`),
  };
}

/** Parse and validate a raw JSON value into a season document. */
export function validateSeasonDocument(raw: unknown): {
  id: string;
  name: string;
  year: number;
  teams: SeededTeam[];
  games: RecordedGame[];
} {
  if (!isRecord(raw)) {
    throw new Error("Season document must be a JSON object");
  }

  const doc = {
    id: requireString(raw, "id", "document"),
    name: requireString(raw, "name", "document"),
    year: requireNumber(raw, "year", "document"),
    teams: [] as SeededTeam[],
    games: [] as RecordedGame[],
  };

  if (!Array.isArray(raw.teams) || raw.teams.length < 2) {
    throw new Error("Season document must include at least two teams");
  }

  if (!Array.isArray(raw.games)) {
    throw new Error("Season document must include a games array");
  }

  doc.teams = raw.teams.map(parseTeam);
  doc.games = raw.games.map(parseGame);

  validateSeededTeams(doc.teams);
  validateRecordedGames(doc.games, teamIdsOf(doc.teams), doc.teams.length);

  return doc;
}
