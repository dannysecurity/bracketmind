import {
  expectedMarginFromRatings,
  isRatingUpset,
} from "../ratings.js";
import { resolveWinProbabilityA } from "../probability/winProbability.js";
import { recordGameResult } from "../tournamentState.js";
import type {
  SimulationOptions,
  SimulationResult,
  Team,
} from "../types.js";
import { resolveSimulationRoundContext } from "./roundContext.js";
import {
  createScoreModel,
  defaultScoreModel,
  validateScoreModel,
  type ScoreModel,
} from "./scoreModel.js";
import { ratingForTeam } from "./helpers.js";
import { withResolvedSeeds } from "./seedContext.js";

const DEFAULT_RNG = Math.random;

/** Expected point margin when `winner` beats `loser`, scaled by rating gap. */
export function expectedMargin(winner: Team, loser: Team): number {
  return expectedMarginFromRatings(winner.rating, loser.rating);
}

function scoreModelForOptions(options: SimulationOptions): ScoreModel {
  const model = options.scoreModel ?? defaultScoreModel();
  if (options.scoreModel !== undefined) {
    validateScoreModel(model);
  }
  return model;
}

/**
 * Generate winner and loser scores from rating gap, margin noise, and spread.
 *
 * Margin is at least 1; when the loser would fall below `loserScoreFloor`,
 * both scores shift upward while preserving the margin.
 */
export function generateScores(
  winnerRating: number,
  loserRating: number,
  rng: () => number,
  scoreModel: ScoreModel = defaultScoreModel()
): { scoreWinner: number; scoreLoser: number } {
  const marginNoise =
    Math.floor(rng() * (2 * scoreModel.marginNoiseRange + 1)) -
    scoreModel.marginNoiseRange;
  const margin = Math.max(
    1,
    expectedMarginFromRatings(winnerRating, loserRating) + marginNoise
  );
  let scoreWinner =
    scoreModel.baseWinnerScore +
    Math.floor(rng() * scoreModel.winnerScoreSpread) +
    Math.floor(margin / 2);
  let scoreLoser = scoreWinner - margin;

  if (scoreLoser < scoreModel.loserScoreFloor) {
    scoreLoser = scoreModel.loserScoreFloor;
    scoreWinner = scoreLoser + margin;
  }

  return { scoreWinner, scoreLoser };
}

/**
 * Simulate a single game between two teams using rating-based probabilities.
 *
 * Consumes exactly three RNG draws: outcome roll, margin noise, and winner
 * score spread. Team A wins when the outcome roll is strictly less than its
 * win probability; a roll equal to the probability awards the win to team B.
 *
 * Seeds resolve from explicit `seedA`/`seedB` options or from `team.seed`
 * when both sides are known, enabling historical upset blending in bracket
 * simulation without separate CLI flags.
 */
export function simulateGame(
  teamA: Team,
  teamB: Team,
  options: SimulationOptions = {}
): SimulationResult {
  const rng = options.rng ?? DEFAULT_RNG;
  const resolvedOptions = withResolvedSeeds(teamA, teamB, options);
  const scoreModel = scoreModelForOptions(resolvedOptions);
  const ratingA = ratingForTeam(teamA, resolvedOptions);
  const ratingB = ratingForTeam(teamB, resolvedOptions);
  const winProbabilityA = resolveWinProbabilityA(
    teamA,
    teamB,
    ratingA,
    ratingB,
    resolvedOptions
  );
  const roll = rng();

  const aWins = roll < winProbabilityA;
  const winner = aWins ? teamA : teamB;
  const loser = aWins ? teamB : teamA;

  const winnerRating = aWins ? ratingA : ratingB;
  const loserRating = aWins ? ratingB : ratingA;
  const { scoreWinner, scoreLoser } = generateScores(
    winnerRating,
    loserRating,
    rng,
    scoreModel
  );
  const scoreA = aWins ? scoreWinner : scoreLoser;
  const scoreB = aWins ? scoreLoser : scoreWinner;
  const margin = Math.abs(scoreA - scoreB);
  const isUpset = isRatingUpset(ratingA, ratingB, aWins);

  let ratingDeltaA: number | undefined;
  let ratingDeltaB: number | undefined;

  if (resolvedOptions.tournamentState) {
    const roundContext = resolveSimulationRoundContext(
      resolvedOptions.round,
      resolvedOptions.totalRounds
    );
    const deltas = recordGameResult(
      resolvedOptions.tournamentState,
      teamA,
      teamB,
      scoreA,
      scoreB,
      {
        ...roundContext,
        margin,
        isUpset,
        seedA: resolvedOptions.seedA,
        seedB: resolvedOptions.seedB,
      },
      resolvedOptions.ratingModel
    );
    ratingDeltaA = deltas.ratingDeltaA;
    ratingDeltaB = deltas.ratingDeltaB;
  }

  return {
    winner,
    scoreA,
    scoreB,
    winProbabilityA,
    margin,
    isUpset,
    ratingDeltaA,
    ratingDeltaB,
  };
}

export { createScoreModel, defaultScoreModel, validateScoreModel, type ScoreModel };
