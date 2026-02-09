import { isRatingUpset } from "../ratings.js";
import { resolveGameOutcome } from "../models/gameCatalog.js";
import type { Season } from "../models/season.js";
import { getSeasonChampion, loadSeasonBracket } from "./hydrateResults.js";
import { resolveSeason } from "./resolveSeason.js";
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

/** Analyze a validated season for completeness and upset counts. */
export function summarizeSeason(doc: SeasonDocument | Season): SeasonSummary {
  const season = resolveSeason(doc);

  let ratingUpsets = 0;
  let seedUpsets = 0;

  for (const game of season.catalog.all) {
    const outcome = resolveGameOutcome(game, season.registry);

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
    season.recordedGames === season.expectedGames && canHydrateSeason(season);

  let championName: string | undefined;
  if (isComplete) {
    championName = getSeasonChampion(season).name;
  }

  return {
    teamCount: season.teamCount,
    totalRounds: season.totalRounds,
    expectedGames: season.expectedGames,
    recordedGames: season.recordedGames,
    isComplete,
    ratingUpsets,
    seedUpsets,
    championName,
  };
}

function canHydrateSeason(season: Season): boolean {
  try {
    loadSeasonBracket(season);
    return true;
  } catch {
    return false;
  }
}
