/** A team entry in a historical season fixture. */
export interface SeasonTeam {
  id: string;
  name: string;
  /** Official tournament seed (1 = highest). */
  seed: number;
  /** Pre-tournament Elo-style rating. */
  rating: number;
}

/** A recorded game result aligned with bracket round/slot indexing. */
export interface SeasonGame {
  round: number;
  slot: number;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  winnerId: string;
}

/** JSON document describing a completed (or partial) tournament season. */
export interface SeasonDocument {
  id: string;
  name: string;
  year: number;
  teams: SeasonTeam[];
  games: SeasonGame[];
}
