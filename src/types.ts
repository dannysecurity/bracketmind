import type { TeamRating } from "./ratings.js";

export interface Team {
  id: string;
  name: string;
  rating: number;
  /** Official tournament seed when known; otherwise derived from rating ranking. */
  seed?: number;
}

export function isByeTeam(team: Team | null | undefined): boolean {
  return team?.name === "BYE";
}

export interface Match {
  id: string;
  round: number;
  slot: number;
  teamA: Team | null;
  teamB: Team | null;
  winner: Team | null;
  scoreA?: number;
  scoreB?: number;
}

export interface Bracket {
  teams: Team[];
  matches: Match[];
  rounds: number;
}

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
}

export interface BracketSimulationOptions {
  /** Random source; defaults to Math.random. */
  rng?: () => number;
  /** Track and update team ratings as the bracket progresses. */
  dynamicRatings?: boolean;
}

/** Aggregated statistics from repeated head-to-head game simulations. */
export interface GameMonteCarloResult {
  iterations: number;
  winRateA: number;
  winRateB: number;
  upsetRate: number;
  avgMargin: number;
  avgScoreA: number;
  avgScoreB: number;
  /** Elo expected win rate for team A before any simulated games. */
  analyticalWinRateA: number;
  /** Outcome of the first simulated game in the batch. */
  sampleResult: SimulationResult;
}
