import type { RecordedGame } from "./game.js";
import { validateGameResult } from "./game.js";
import type { TeamId } from "./team.js";

/** Bracket geometry implied by a team count (power-of-two field). */
export interface BracketGeometry {
  rounds: number;
  maxSlot: (round: number) => number;
}

export function bracketGeometryForTeamCount(teamCount: number): BracketGeometry {
  const rounds = Math.ceil(Math.log2(teamCount));
  return {
    rounds,
    maxSlot: (round: number) => Math.pow(2, rounds - round - 1),
  };
}

/** Validate recorded games against known team ids and bracket geometry. */
export function validateRecordedGames(
  games: readonly RecordedGame[],
  teamIds: ReadonlySet<TeamId>,
  teamCount: number
): void {
  const { rounds, maxSlot } = bracketGeometryForTeamCount(teamCount);

  for (const game of games) {
    if (!Number.isInteger(game.round) || game.round < 0 || game.round >= rounds) {
      throw new Error(
        `Game round ${game.round} is out of range for ${teamCount} teams`
      );
    }

    if (!Number.isInteger(game.slot) || game.slot < 0 || game.slot >= maxSlot(game.round)) {
      throw new Error(
        `Game slot ${game.slot} is out of range for round ${game.round}`
      );
    }

    for (const id of [game.teamAId, game.teamBId, game.winnerId]) {
      if (!teamIds.has(id)) {
        throw new Error(`Game references unknown team id "${id}"`);
      }
    }

    validateGameResult(
      game,
      game,
      `round ${game.round}, slot ${game.slot}`
    );
  }
}
