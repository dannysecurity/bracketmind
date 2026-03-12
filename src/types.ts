import type { TeamRating } from "./models/teamRating.js";
import type { RatingModel } from "./ratingsModel.js";
import type { ScoreModel } from "./simulation/scoreModel.js";
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

/** Outcome of a best-of-N head-to-head series between two teams. */
export interface SeriesSimulationResult {
  /** Series length (odd integer, e.g. 3 or 5). */
  bestOf: number;
  winsA: number;
  winsB: number;
  winner: Team;
  /** Per-game simulation results in chronological order. */
  games: SimulationResult[];
  /** Team A after the series (ratings may change when dynamic ratings are enabled). */
  teamA: Team;
  /** Team B after the series (ratings may change when dynamic ratings are enabled). */
  teamB: Team;
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
  /** Tunable score-generation parameters; defaults to production model. */
  scoreModel?: ScoreModel;
  /** Tournament seed for team A; pairs with `seedB` for historical upset blending. */
  seedA?: number;
  /** Tournament seed for team B; pairs with `seedA` for historical upset blending. */
  seedB?: number;
  /**
   * Weight (0–1) for NCAA historical seed upset rates when blending with Elo.
   * Requires both `seedA` and `seedB`.
   */
  historicalWeight?: number;
}

export interface BracketSimulationOptions {
  /** Random source; defaults to Math.random. */
  rng?: () => number;
  /** Track and update team ratings as the bracket progresses. */
  dynamicRatings?: boolean;
  /** Tunable Elo update parameters when dynamicRatings is enabled. */
  ratingModel?: RatingModel;
  /**
   * Weight (0–1) for NCAA historical seed upset rates when blending with Elo.
   * Requires teams to carry official seeds (or explicit seed overrides per game).
   */
  historicalWeight?: number;
  /**
   * Pre-seed games-played counts before the bracket starts.
   * Useful for teams entering with prior-season history (provisional vs established K).
   */
  priorGamesPlayed?: ReadonlyMap<string, number>;
  /**
   * Receives live tournament state after simulation when dynamicRatings is enabled.
   * Useful for tests and diagnostics that inspect games-played bookkeeping.
   */
  onTournamentState?: (state: TournamentState) => void;
}

/** Margin distribution percentiles from repeated head-to-head simulations. */
export interface MarginPercentiles {
  p10: number;
  p50: number;
  p90: number;
}

/** Wilson score confidence interval for a simulated win rate. */
export interface WinRateConfidenceInterval {
  low: number;
  high: number;
}

/** Aggregated statistics from repeated head-to-head game simulations. */
export interface GameMonteCarloResult {
  iterations: number;
  winRateA: number;
  winRateB: number;
  /** 95% Wilson score interval for team A's simulated win rate. */
  winRateConfidenceA: WinRateConfidenceInterval;
  /** 95% Wilson score interval for team B's simulated win rate. */
  winRateConfidenceB: WinRateConfidenceInterval;
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
