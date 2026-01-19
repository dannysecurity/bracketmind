import { matchIndex } from "../bracket/layout.js";
import type { Bracket, Team } from "../types.js";

/** Advance a winner into the next-round match slot for standard single elimination. */
export function advanceWinner(
  bracket: Bracket,
  round: number,
  slot: number,
  winner: Team
): void {
  if (round + 1 >= bracket.rounds) {
    return;
  }

  const nextIdx = matchIndex(round + 1, Math.floor(slot / 2), bracket.rounds);
  const nextMatch = bracket.matches[nextIdx];

  if (slot % 2 === 0) {
    nextMatch.teamA = winner;
  } else {
    nextMatch.teamB = winner;
  }
}
