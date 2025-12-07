import {
  createTeamRating,
  updateTeamRatings,
  type TeamRating,
} from "./ratings.js";
import type { Team, TournamentState } from "./types.js";

/** Initialize tournament rating state from the bracket field. */
export function createTournamentState(teams: Team[]): TournamentState {
  const ratings = new Map<string, TeamRating>();

  for (const team of teams) {
    if (team.name === "BYE") {
      continue;
    }
    ratings.set(team.id, createTeamRating(team.rating));
  }

  return { ratings };
}

/** Current effective rating for a team, falling back to its seed rating. */
export function effectiveRating(team: Team, state: TournamentState): number {
  return state.ratings.get(team.id)?.rating ?? team.rating;
}

/** Apply a finished game's score to tournament ratings and sync team objects. */
export function recordGameResult(
  state: TournamentState,
  teamA: Team,
  teamB: Team,
  scoreA: number,
  scoreB: number
): { ratingDeltaA: number; ratingDeltaB: number } {
  const ratingA = state.ratings.get(teamA.id);
  const ratingB = state.ratings.get(teamB.id);

  if (!ratingA || !ratingB) {
    return { ratingDeltaA: 0, ratingDeltaB: 0 };
  }

  const [newA, newB] = updateTeamRatings(ratingA, ratingB, scoreA, scoreB);
  const ratingDeltaA = newA.rating - ratingA.rating;
  const ratingDeltaB = newB.rating - ratingB.rating;

  state.ratings.set(teamA.id, newA);
  state.ratings.set(teamB.id, newB);
  teamA.rating = newA.rating;
  teamB.rating = newB.rating;

  return { ratingDeltaA, ratingDeltaB };
}
