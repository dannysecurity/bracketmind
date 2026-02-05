import { createBracket, simulateBracket } from "../bracket.js";
import { createRatingModel, type RatingModel } from "../ratingsModel.js";
import { createTournamentState } from "../tournamentState.js";
import type {
  Bracket,
  BracketSimulationOptions,
  Team,
  TournamentState,
  WinRateConfidenceInterval,
} from "../types.js";
import {
  assertBracketSimulationInvariants,
  ratedField,
} from "./simulationFixtures.js";

/** Build a rating model by overriding production defaults. */
export function customRatingModel(
  overrides: Partial<RatingModel> = {}
): RatingModel {
  return createRatingModel(overrides);
}

/** Assert a Wilson interval is well-formed and brackets the observed rate. */
export function assertWilsonIntervalContract(
  interval: WinRateConfidenceInterval,
  successes: number,
  trials: number
): void {
  if (trials <= 0) {
    if (interval.low !== 0 || interval.high !== 0) {
      throw new Error(
        `Expected zero interval for invalid trials (${successes}/${trials})`
      );
    }
    return;
  }

  if (interval.low < 0 || interval.high > 1) {
    throw new Error(
      `Wilson interval out of [0, 1]: [${interval.low}, ${interval.high}]`
    );
  }

  if (interval.low > interval.high) {
    throw new Error(
      `Wilson interval inverted: low=${interval.low}, high=${interval.high}`
    );
  }

  const rate = successes / trials;
  if (interval.low > rate + 1e-12) {
    throw new Error(
      `Wilson low (${interval.low}) exceeds observed rate (${rate})`
    );
  }
  if (interval.high < rate - 1e-12) {
    throw new Error(
      `Wilson high (${interval.high}) below observed rate (${rate})`
    );
  }
}

/** Sum seed ratings for every non-BYE team in a field. */
export function totalSeedRatingPoints(teams: Team[]): number {
  return teams
    .filter((entry) => entry.name !== "BYE")
    .reduce((sum, entry) => sum + entry.rating, 0);
}

/** Sum live ratings for every non-BYE team after simulation. */
export function totalLiveRatingPoints(bracket: Bracket): number {
  return bracket.teams
    .filter((entry) => entry.name !== "BYE")
    .reduce((sum, entry) => sum + entry.rating, 0);
}

/** Assert rating points are conserved within an optional tolerance. */
export function assertRatingTotalConserved(
  before: number,
  after: number,
  tolerance = 0
): void {
  if (Math.abs(before - after) > tolerance) {
    throw new Error(`Rating total changed: ${before} -> ${after}`);
  }
}

/** Initialize tournament state and optionally pre-seed games-played counts. */
export function tournamentStateWithHistory(
  teams: Team[],
  priorGamesPlayed?: ReadonlyMap<string, number>
): TournamentState {
  const state = createTournamentState(teams);
  if (priorGamesPlayed) {
    for (const [teamId, gamesPlayed] of priorGamesPlayed) {
      const entry = state.ratings.get(teamId);
      if (entry) {
        entry.gamesPlayed = gamesPlayed;
      }
    }
  }
  return state;
}

/** Build and simulate a rated field, asserting bracket invariants. */
export function simulateRatedField(
  teamCount: number,
  options: BracketSimulationOptions = {},
  topRating = 1700,
  step = 25
): Bracket {
  const teams = ratedField(teamCount, topRating, step);
  const result = simulateBracket(createBracket(teams), options);
  assertBracketSimulationInvariants(result);
  return result;
}

/** Run a callback for each seed in a property-style sweep. */
export function forEachSimulationSeed(
  seeds: number[],
  run: (seed: number) => void
): void {
  for (const seed of seeds) {
    run(seed);
  }
}
