import { isRatingUpset } from "../ratings.js";
import { teamMapFromDocument } from "./adapters.js";
import { getSeasonChampion, loadSeasonBracket } from "./hydrateResults.js";
import type { SeasonDocument } from "./types.js";

export interface SeasonSummary {
  teamCount: number;
  totalRounds: number;
  expectedGames: number;
  recordedGames: number;
  isComplete: boolean;
  ratingUpsets: number;
  seedUpsets: number;
  championName?: string;
}

/** Analyze a validated season document for completeness and upset counts. */
export function summarizeSeason(doc: SeasonDocument): SeasonSummary {
  const teamCount = doc.teams.length;
  const totalRounds = Math.ceil(Math.log2(teamCount));
  const expectedGames = teamCount - 1;
  const recordedGames = doc.games.length;

  const teamById = teamMapFromDocument(doc);
  const seedById = new Map(doc.teams.map((team) => [team.id, team.seed]));

  let ratingUpsets = 0;
  let seedUpsets = 0;

  for (const game of doc.games) {
    const teamA = teamById.get(game.teamAId)!;
    const teamB = teamById.get(game.teamBId)!;
    const winnerIsA = game.winnerId === game.teamAId;

    if (isRatingUpset(teamA.rating, teamB.rating, winnerIsA)) {
      ratingUpsets++;
    }

    const winnerSeed = seedById.get(game.winnerId)!;
    const loserId = winnerIsA ? game.teamBId : game.teamAId;
    const loserSeed = seedById.get(loserId)!;
    if (winnerSeed > loserSeed) {
      seedUpsets++;
    }
  }

  const isComplete =
    recordedGames === expectedGames && canHydrateSeason(doc);

  let championName: string | undefined;
  if (isComplete) {
    championName = getSeasonChampion(doc).name;
  }

  return {
    teamCount,
    totalRounds,
    expectedGames,
    recordedGames,
    isComplete,
    ratingUpsets,
    seedUpsets,
    championName,
  };
}

function canHydrateSeason(doc: SeasonDocument): boolean {
  try {
    loadSeasonBracket(doc);
    return true;
  } catch {
    return false;
  }
}
