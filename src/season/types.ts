import type { RecordedGame, SeededTeam } from "../models/index.js";

/** A team entry in a historical season fixture. */
export type SeasonTeam = SeededTeam;

/** A recorded game result aligned with bracket round/slot indexing. */
export type SeasonGame = RecordedGame;

/** JSON document describing a completed (or partial) tournament season. */
export interface SeasonDocument {
  id: string;
  name: string;
  year: number;
  teams: SeasonTeam[];
  games: SeasonGame[];
}
