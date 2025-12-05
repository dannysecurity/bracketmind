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

export interface SimulationResult {
  winner: Team;
  scoreA: number;
  scoreB: number;
  winProbabilityA: number;
}

export interface SimulationOptions {
  /** Random source; defaults to Math.random. */
  rng?: () => number;
}
