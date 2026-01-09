import type { SeasonDocument, SeasonGame, SeasonTeam } from "./types.js";

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

function parseTeam(raw: unknown, index: number): SeasonTeam {
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

function parseGame(raw: unknown, index: number): SeasonGame {
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
export function validateSeasonDocument(raw: unknown): SeasonDocument {
  if (!isRecord(raw)) {
    throw new Error("Season document must be a JSON object");
  }

  const doc: SeasonDocument = {
    id: requireString(raw, "id", "document"),
    name: requireString(raw, "name", "document"),
    year: requireNumber(raw, "year", "document"),
    teams: [],
    games: [],
  };

  if (!Array.isArray(raw.teams) || raw.teams.length < 2) {
    throw new Error("Season document must include at least two teams");
  }

  if (!Array.isArray(raw.games)) {
    throw new Error("Season document must include a games array");
  }

  doc.teams = raw.teams.map(parseTeam);
  doc.games = raw.games.map(parseGame);

  validateTeamUniqueness(doc.teams);
  validateSeeds(doc.teams);
  validateGames(doc);

  return doc;
}

function validateTeamUniqueness(teams: SeasonTeam[]): void {
  const ids = new Set<string>();
  for (const team of teams) {
    if (ids.has(team.id)) {
      throw new Error(`Duplicate team id "${team.id}"`);
    }
    ids.add(team.id);
  }
}

function validateSeeds(teams: SeasonTeam[]): void {
  const seeds = teams.map((team) => team.seed).sort((a, b) => a - b);
  for (let i = 0; i < seeds.length; i++) {
    if (seeds[i] !== i + 1) {
      throw new Error(
        `Team seeds must be consecutive integers from 1 to ${teams.length}`
      );
    }
  }
}

function validateGames(doc: SeasonDocument): void {
  const teamIds = new Set(doc.teams.map((team) => team.id));
  const rounds = Math.ceil(Math.log2(doc.teams.length));
  const maxSlot = (round: number) => Math.pow(2, rounds - round - 1);

  for (const game of doc.games) {
    if (!Number.isInteger(game.round) || game.round < 0 || game.round >= rounds) {
      throw new Error(
        `Game round ${game.round} is out of range for ${doc.teams.length} teams`
      );
    }

    if (!Number.isInteger(game.slot) || game.slot < 0 || game.slot >= maxSlot(game.round)) {
      throw new Error(
        `Game slot ${game.slot} is out of range for round ${game.round}`
      );
    }

    for (const id of [game.teamAId, game.teamBId, game.winnerId]) {
      if (!teamIds.has(id)) {
        throw new Error(`Game references unknown team id "${id}"`);
      }
    }

    if (game.winnerId !== game.teamAId && game.winnerId !== game.teamBId) {
      throw new Error(
        `Winner "${game.winnerId}" must be teamA or teamB in round ${game.round}, slot ${game.slot}`
      );
    }

    const winnerScore = game.winnerId === game.teamAId ? game.scoreA : game.scoreB;
    const loserScore = game.winnerId === game.teamAId ? game.scoreB : game.scoreA;

    if (winnerScore <= loserScore) {
      throw new Error(
        `Winner must outscore the loser in round ${game.round}, slot ${game.slot}`
      );
    }

    if (game.scoreA < 0 || game.scoreB < 0) {
      throw new Error(
        `Scores must be non-negative in round ${game.round}, slot ${game.slot}`
      );
    }
  }
}
