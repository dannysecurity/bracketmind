import { upsetProbability } from "../ratings.js";
import type { Team } from "../types.js";

/** Probability the lower-rated team upsets the favorite; null for BYE matchups. */
export function matchupUpsetProbability(
  teamA: Team,
  teamB: Team
): number | null {
  if (teamA.name === "BYE" || teamB.name === "BYE") {
    return null;
  }

  const favoriteRating = Math.max(teamA.rating, teamB.rating);
  const underdogRating = Math.min(teamA.rating, teamB.rating);
  return upsetProbability(favoriteRating, underdogRating);
}
