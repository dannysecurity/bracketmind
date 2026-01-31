import {
  updateTeamRatingsWithContext,
  type GameRatingContext,
} from "./eloUpdates.js";
import { createTeamRating, isRatingUpset, type TeamRating } from "./ratings.js";
import { defaultRatingModel, type RatingModel } from "./ratingsModel.js";
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
  scoreB: number,
  context?: Partial<GameRatingContext>,
  model: RatingModel = defaultRatingModel()
): { ratingDeltaA: number; ratingDeltaB: number } {
  const ratingA = state.ratings.get(teamA.id);
  const ratingB = state.ratings.get(teamB.id);

  if (!ratingA || !ratingB) {
    return { ratingDeltaA: 0, ratingDeltaB: 0 };
  }

  const isTie = scoreA === scoreB;
  const winnerIsA = scoreA > scoreB;
  const fullContext: GameRatingContext = {
    round: context?.round ?? 0,
    totalRounds: context?.totalRounds ?? 1,
    margin: context?.margin ?? Math.abs(scoreA - scoreB),
    isUpset:
      context?.isUpset ??
      isRatingUpset(ratingA.rating, ratingB.rating, winnerIsA, isTie),
  };

  const [newA, newB] = updateTeamRatingsWithContext(
    ratingA,
    ratingB,
    scoreA,
    scoreB,
    fullContext,
    model
  );
  const ratingDeltaA = newA.rating - ratingA.rating;
  const ratingDeltaB = newB.rating - ratingB.rating;

  state.ratings.set(teamA.id, newA);
  state.ratings.set(teamB.id, newB);
  teamA.rating = newA.rating;
  teamB.rating = newB.rating;

  return { ratingDeltaA, ratingDeltaB };
}
