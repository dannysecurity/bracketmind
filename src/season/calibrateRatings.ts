import { isRatingUpset } from "../ratings.js";
import { defaultRatingModel, type RatingModel } from "../ratingsModel.js";
import { replaySeasonRatings } from "./replayRatings.js";
import type { SeasonDocument } from "./types.js";

/** Winner of the last recorded bracket game. */
function championIdFromDocument(doc: SeasonDocument): string {
  if (doc.games.length === 0) {
    throw new Error(`Season ${doc.id} has no recorded games`);
  }
  const finalRound = Math.max(...doc.games.map((game) => game.round));
  const finalGame = doc.games
    .filter((game) => game.round === finalRound)
    .sort((a, b) => a.slot - b.slot)
    .at(-1);
  if (!finalGame) {
    throw new Error(`Season ${doc.id} has no games in round ${finalRound}`);
  }
  return finalGame.winnerId;
}

/** Metrics from replaying a season fixture through a rating model. */
export interface RatingCalibrationResult {
  fixtureId: string;
  fixtureName: string;
  teamCount: number;
  gameCount: number;
  /** Net rating change across all teams (should be near zero). */
  totalRatingChange: number;
  /** Champion's rating delta after replay. */
  championDelta: number;
  /** Rank of the champion among teams sorted by delta (1 = highest). */
  championDeltaRank: number;
  /** Upsets where the lower-rated team gained more rating than the favorite lost. */
  upsetWinnerGainedMore: number;
  /** Total recorded upsets in the fixture. */
  upsetCount: number;
  /** Minimum team rating after replay. */
  minEndRating: number;
}

/**
 * Replay a season fixture and collect calibration metrics for a rating model.
 *
 * Useful for comparing model variants against historical tournament outcomes:
 * champions should rank highly by delta, rating totals should stay conserved,
 * and upset winners should generally gain more than favorites lose.
 */
export function calibrateRatingModel(
  doc: SeasonDocument,
  model: RatingModel = defaultRatingModel()
): RatingCalibrationResult {
  const startRatings = new Map(doc.teams.map((team) => [team.id, team.rating]));
  const { deltas } = replaySeasonRatings(doc, model);
  const champion = championIdFromDocument(doc);

  const sortedByDelta = [...deltas].sort((a, b) => b.delta - a.delta);
  const championDelta =
    deltas.find((entry) => entry.team.id === champion)?.delta ?? 0;
  const championDeltaRank =
    sortedByDelta.findIndex((entry) => entry.team.id === champion) + 1;

  const totalRatingChange = deltas.reduce((sum, entry) => sum + entry.delta, 0);
  const minEndRating = Math.min(...deltas.map((entry) => entry.endRating));

  let upsetWinnerGainedMore = 0;
  let upsetCount = 0;

  for (const game of doc.games) {
    const ratingA = startRatings.get(game.teamAId) ?? 0;
    const ratingB = startRatings.get(game.teamBId) ?? 0;
    const winnerIsA = game.winnerId === game.teamAId;
    const isUpset = isRatingUpset(ratingA, ratingB, winnerIsA);
    if (!isUpset) {
      continue;
    }

    upsetCount++;
    const deltaA =
      (deltas.find((entry) => entry.team.id === game.teamAId)?.delta ?? 0);
    const deltaB =
      (deltas.find((entry) => entry.team.id === game.teamBId)?.delta ?? 0);

    const winnerDelta = winnerIsA ? deltaA : deltaB;
    const loserDelta = winnerIsA ? deltaB : deltaA;
    if (winnerDelta > 0 && Math.abs(winnerDelta) >= Math.abs(loserDelta)) {
      upsetWinnerGainedMore++;
    }
  }

  return {
    fixtureId: doc.id,
    fixtureName: doc.name,
    teamCount: doc.teams.length,
    gameCount: doc.games.length,
    totalRatingChange,
    championDelta,
    championDeltaRank,
    upsetWinnerGainedMore,
    upsetCount,
    minEndRating,
  };
}

/** Calibrate a rating model against every bundled season fixture. */
export function calibrateAllFixtures(
  model: RatingModel = defaultRatingModel(),
  documents: SeasonDocument[]
): RatingCalibrationResult[] {
  return documents.map((doc) => calibrateRatingModel(doc, model));
}

/** Summarize calibration results across multiple fixtures. */
export function summarizeCalibration(
  results: RatingCalibrationResult[]
): {
  fixtureCount: number;
  championsRankedFirst: number;
  maxTotalRatingChange: number;
  minEndRating: number;
} {
  return {
    fixtureCount: results.length,
    championsRankedFirst: results.filter((r) => r.championDeltaRank === 1).length,
    maxTotalRatingChange: Math.max(
      ...results.map((r) => Math.abs(r.totalRatingChange))
    ),
    minEndRating: Math.min(...results.map((r) => r.minEndRating)),
  };
}
