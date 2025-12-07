import type { TeamRating } from "./ratings.js";

export interface Team {
  id: string;
  name: string;
  rating: number;
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
}

export interface BracketSimulationOptions {
  /** Random source; defaults to Math.random. */
  rng?: () => number;
  /** Track and update team ratings as the bracket progresses. */
  dynamicRatings?: boolean;
}
