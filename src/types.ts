import type { TeamRating } from "./ratings.js";
import type { RatingModel } from "./ratingsModel.js";
import type { Team } from "./models/index.js";

export type {
  Bracket,
  GameResult,
  Match,
  RecordedGame,
  Team,
} from "./models/index.js";
export {
  isByeTeam,
  isCompletedMatch,
  recordedGamesFromBracket,
} from "./models/index.js";

/** Per-team rating tracking for games played within a single tournament run. */
export interface TournamentState {
  readonly ratings: Map<string, TeamRating>;
}

export interface SimulationResult {
  winner: Team;
  scoreA: number;
  scoreB: number;
  winProbabilityA: number;
  margin: number;
  isUpset: boolean;
  ratingDeltaA?: number;
  ratingDeltaB?: number;
}

export interface SimulationOptions {
  /** Random source; defaults to Math.random. */
  rng?: () => number;
  /** When set, game outcomes use live ratings and scores update tournament state. */
  tournamentState?: TournamentState;
  /** 0-based round index; scales Elo K-factor for later rounds. */
  round?: number;
  /** Total bracket rounds; used with `round` for contextual Elo updates. */
  totalRounds?: number;
  /** Tunable Elo update parameters; defaults to production model. */
  ratingModel?: RatingModel;
}

export interface BracketSimulationOptions {
  /** Random source; defaults to Math.random. */
  rng?: () => number;
  /** Track and update team ratings as the bracket progresses. */
  dynamicRatings?: boolean;
  /** Tunable Elo update parameters when dynamicRatings is enabled. */
  ratingModel?: RatingModel;
}

/** Margin distribution percentiles from repeated head-to-head simulations. */
export interface MarginPercentiles {
  p10: number;
  p50: number;
  p90: number;
}

/** Aggregated statistics from repeated head-to-head game simulations. */
export interface GameMonteCarloResult {
  iterations: number;
  winRateA: number;
  winRateB: number;
  upsetRate: number;
  avgMargin: number;
  /** Population standard deviation of point margins across trials. */
  marginStdDev: number;
  /** 10th, 50th, and 90th percentile margins across trials. */
  marginPercentiles: MarginPercentiles;
  avgScoreA: number;
  avgScoreB: number;
  /** Elo expected win rate for team A before any simulated games. */
  analyticalWinRateA: number;
  /** Outcome of the first simulated game in the batch. */
  sampleResult: SimulationResult;
}
