import { isRatingUpset } from "../ratings.js";
import type { Match } from "../types.js";
import { isByeTeam } from "../types.js";
import type { MatchView, TeamView } from "./bracketView.js";

/** Label shown beside completed matches where the underdog won. */
export const UPSET_LABEL = "UPSET";

/** True when the lower-rated team won a completed, playable matchup. */
export function wasMatchUpset(match: {
  teamA: TeamView | null;
  teamB: TeamView | null;
  winner: TeamView | null;
}): boolean {
  if (!match.teamA || !match.teamB || !match.winner) {
    return false;
  }
  if (match.teamA.isBye || match.teamB.isBye) {
    return false;
  }

  const winnerIsA = match.winner.name === match.teamA.name;
  return isRatingUpset(match.teamA.rating, match.teamB.rating, winnerIsA);
}

/** Detect rating upsets from raw bracket matches during view-model construction. */
export function wasRatingUpsetMatch(match: Match): boolean {
  if (!match.teamA || !match.teamB || !match.winner) {
    return false;
  }
  if (isByeTeam(match.teamA) || isByeTeam(match.teamB)) {
    return false;
  }

  const winnerIsA = match.winner.id === match.teamA.id;
  return isRatingUpset(match.teamA.rating, match.teamB.rating, winnerIsA);
}

/** Count completed rating upsets across every round in a bracket view. */
export function countUpsets(view: { matchesByRound: MatchView[][] }): number {
  let total = 0;
  for (const round of view.matchesByRound) {
    for (const match of round) {
      if (match.wasUpset) {
        total++;
      }
    }
  }
  return total;
}
