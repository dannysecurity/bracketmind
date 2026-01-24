import {
  expectedMarginFromRatings,
  expectedScore,
  isRatingUpset,
} from "./ratings.js";
import {
  createTournamentState,
  effectiveRating,
  recordGameResult,
} from "./tournamentState.js";
import type {
  GameMonteCarloResult,
  SimulationOptions,
  SimulationResult,
  Team,
} from "./types.js";

const DEFAULT_RNG = Math.random;
const BASE_WINNER_SCORE = 68;
const WINNER_SCORE_SPREAD = 12;
const LOSER_SCORE_FLOOR = 55;
const MARGIN_NOISE_RANGE = 5;

/** Deterministic RNG from a numeric seed (mulberry32). */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Expected point margin when `winner` beats `loser`, scaled by rating gap. */
export function expectedMargin(winner: Team, loser: Team): number {
  return expectedMarginFromRatings(winner.rating, loser.rating);
}

function generateScores(
  winnerRating: number,
  loserRating: number,
  rng: () => number
): { scoreWinner: number; scoreLoser: number } {
  const marginNoise =
    Math.floor(rng() * (2 * MARGIN_NOISE_RANGE + 1)) - MARGIN_NOISE_RANGE;
  const margin = Math.max(
    1,
    expectedMarginFromRatings(winnerRating, loserRating) + marginNoise
  );
  const scoreWinner =
    BASE_WINNER_SCORE +
    Math.floor(rng() * WINNER_SCORE_SPREAD) +
    Math.floor(margin / 2);
  const scoreLoser = Math.max(LOSER_SCORE_FLOOR, scoreWinner - margin);

  return { scoreWinner, scoreLoser };
}

function ratingForTeam(team: Team, options: SimulationOptions): number {
  if (options.tournamentState) {
    return effectiveRating(team, options.tournamentState);
  }
  return team.rating;
}

/** Simulate a single game between two teams using rating-based probabilities. */
export function simulateGame(
  teamA: Team,
  teamB: Team,
  options: SimulationOptions = {}
): SimulationResult {
  const rng = options.rng ?? DEFAULT_RNG;
  const ratingA = ratingForTeam(teamA, options);
  const ratingB = ratingForTeam(teamB, options);
  const winProbabilityA = expectedScore(ratingA, ratingB);
  const roll = rng();

  const aWins = roll < winProbabilityA;
  const winner = aWins ? teamA : teamB;
  const loser = aWins ? teamB : teamA;

  const winnerRating = aWins ? ratingA : ratingB;
  const loserRating = aWins ? ratingB : ratingA;
  const { scoreWinner, scoreLoser } = generateScores(
    winnerRating,
    loserRating,
    rng
  );
  const scoreA = aWins ? scoreWinner : scoreLoser;
  const scoreB = aWins ? scoreLoser : scoreWinner;
  const margin = Math.abs(scoreA - scoreB);
  const isUpset = isRatingUpset(ratingA, ratingB, aWins);

  let ratingDeltaA: number | undefined;
  let ratingDeltaB: number | undefined;

  if (options.tournamentState) {
    const deltas = recordGameResult(
      options.tournamentState,
      teamA,
      teamB,
      scoreA,
      scoreB,
      {
        round: options.round,
        totalRounds: options.totalRounds,
        margin,
        isUpset,
      }
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

function cloneTeam(team: Team): Team {
  return { ...team };
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function marginStdDev(margins: number[], avgMargin: number): number {
  if (margins.length <= 1) {
    return 0;
  }

  const variance =
    margins.reduce((sum, margin) => sum + (margin - avgMargin) ** 2, 0) /
    margins.length;
  return Math.sqrt(variance);
}

function summarizeMargins(margins: number[], avgMargin: number) {
  const sorted = [...margins].sort((a, b) => a - b);
  return {
    marginStdDev: marginStdDev(margins, avgMargin),
    marginPercentiles: {
      p10: percentile(sorted, 10),
      p50: percentile(sorted, 50),
      p90: percentile(sorted, 90),
    },
  };
}

/** Run many head-to-head simulations and aggregate win, score, and upset rates. */
export function monteCarloGameOutcomes(
  teamA: Team,
  teamB: Team,
  iterations: number,
  options: SimulationOptions = {}
): GameMonteCarloResult {
  if (iterations <= 0) {
    throw new Error("At least one iteration is required");
  }

  const rng = options.rng ?? DEFAULT_RNG;
  const ratingA = ratingForTeam(teamA, options);
  const ratingB = ratingForTeam(teamB, options);
  const analyticalWinRateA = expectedScore(ratingA, ratingB);

  let winsA = 0;
  let upsets = 0;
  let marginTotal = 0;
  let scoreATotal = 0;
  let scoreBTotal = 0;
  const margins: number[] = [];
  let sampleResult: SimulationResult | undefined;

  for (let i = 0; i < iterations; i++) {
    const simTeamA = cloneTeam(teamA);
    const simTeamB = cloneTeam(teamB);
    const simOptions: SimulationOptions = {
      ...options,
      rng,
      tournamentState: options.tournamentState
        ? createTournamentState([simTeamA, simTeamB])
        : undefined,
    };

    const result = simulateGame(simTeamA, simTeamB, simOptions);
    if (sampleResult === undefined) {
      sampleResult = result;
    }

    if (result.winner.id === teamA.id) {
      winsA++;
    }
    if (result.isUpset) {
      upsets++;
    }
    marginTotal += result.margin;
    margins.push(result.margin);
    scoreATotal += result.scoreA;
    scoreBTotal += result.scoreB;
  }

  const avgMargin = marginTotal / iterations;
  const marginSummary = summarizeMargins(margins, avgMargin);

  return {
    iterations,
    winRateA: winsA / iterations,
    winRateB: (iterations - winsA) / iterations,
    upsetRate: upsets / iterations,
    avgMargin,
    marginStdDev: marginSummary.marginStdDev,
    marginPercentiles: marginSummary.marginPercentiles,
    avgScoreA: scoreATotal / iterations,
    avgScoreB: scoreBTotal / iterations,
    analyticalWinRateA,
    sampleResult: sampleResult!,
  };
}

/** Run many simulations and return each team's championship rate. */
export function monteCarloChampionshipRates(
  teams: Team[],
  iterations: number,
  simulateBracketFn: (teams: Team[]) => Team
): Map<string, number> {
  if (iterations <= 0) {
    throw new Error("At least one iteration is required");
  }

  const wins = new Map<string, number>();
  for (const team of teams) {
    wins.set(team.id, 0);
  }

  for (let i = 0; i < iterations; i++) {
    const champion = simulateBracketFn(teams.map((t) => ({ ...t })));
    wins.set(champion.id, (wins.get(champion.id) ?? 0) + 1);
  }

  const rates = new Map<string, number>();
  for (const [id, count] of wins) {
    rates.set(id, count / iterations);
  }
  return rates;
}

export { createTournamentState } from "./tournamentState.js";
