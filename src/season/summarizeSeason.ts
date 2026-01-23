import { isRatingUpset } from "../ratings.js";
import { GameCatalog, resolveGameOutcome } from "../models/gameCatalog.js";
import { teamRegistryFromDocument } from "./adapters.js";
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

  const registry = teamRegistryFromDocument(doc);
  const catalog = GameCatalog.fromGames(doc.games);

  let ratingUpsets = 0;
  let seedUpsets = 0;

  for (const game of catalog.all) {
    const outcome = resolveGameOutcome(game, registry);

    if (
      isRatingUpset(outcome.teamA.rating, outcome.teamB.rating, outcome.winnerIsA)
    ) {
      ratingUpsets++;
    }

    if (outcome.winnerSeed > outcome.loserSeed) {
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
