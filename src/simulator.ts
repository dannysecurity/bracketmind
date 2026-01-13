import { expectedScore } from "./ratings.js";
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

function marginFromRatings(winnerRating: number, loserRating: number): number {
  const gap = winnerRating - loserRating;
  const isUpset = gap < 0;
  const gapFactor = Math.abs(gap) / 40;
  const base = 5 + gapFactor * (isUpset ? 0.35 : 1);
  return Math.max(1, Math.round(base));
}

/** Expected point margin when `winner` beats `loser`, scaled by rating gap. */
export function expectedMargin(winner: Team, loser: Team): number {
  return marginFromRatings(winner.rating, loser.rating);
}

function generateScores(
  winnerRating: number,
  loserRating: number,
  rng: () => number
): { scoreWinner: number; scoreLoser: number } {
  const margin = Math.max(
    1,
    marginFromRatings(winnerRating, loserRating) + Math.floor(rng() * 10 - 5)
  );
  const scoreWinner = 68 + Math.floor(rng() * 12) + Math.floor(margin / 2);
  const scoreLoser = Math.max(55, scoreWinner - margin);

  return { scoreWinner, scoreLoser };
}

function ratingForTeam(team: Team, options: SimulationOptions): number {
  if (options.tournamentState) {
    return effectiveRating(team, options.tournamentState);
  }
  return team.rating;
}

function favoriteTeam(teamA: Team, teamB: Team, ratingA: number, ratingB: number): Team {
  if (ratingA === ratingB) {
    return teamA;
  }
  return ratingA > ratingB ? teamA : teamB;
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
  const preGameFavorite = favoriteTeam(teamA, teamB, ratingA, ratingB);

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
  const isUpset =
    ratingA !== ratingB && winner.id !== preGameFavorite.id;

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
    scoreATotal += result.scoreA;
    scoreBTotal += result.scoreB;
  }

  return {
    iterations,
    winRateA: winsA / iterations,
    winRateB: (iterations - winsA) / iterations,
    upsetRate: upsets / iterations,
    avgMargin: marginTotal / iterations,
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
