import { isRatingUpset } from "../ratings.js";
import {
  DEFAULT_HISTORICAL_WEIGHT,
  forecastMatchupUpset,
  type UpsetOutlookOptions,
} from "../probability/seedUpsets.js";
import type { Season } from "../models/season.js";
import { createTournamentState, recordGameResult } from "../tournamentState.js";
import { defaultRatingModel, type RatingModel } from "../ratingsModel.js";
import type { Team, TournamentState } from "../types.js";
import { isByeTeam } from "../types.js";
import { createBracketFromSeason, matchIndex } from "./buildBracket.js";
import { resolveSeason } from "./resolveSeason.js";
import type { SeasonDocument } from "./types.js";

export interface SeasonRatingDelta {
  team: Team;
  startRating: number;
  endRating: number;
  delta: number;
}

export interface SeasonRatingReplay {
  state: TournamentState;
  deltas: SeasonRatingDelta[];
}

/** Replay recorded season games through the Elo update pipeline. */
export function replaySeasonRatings(
  doc: SeasonDocument | Season,
  model: RatingModel = defaultRatingModel()
): SeasonRatingReplay {
  const season = resolveSeason(doc);
  const bracket = createBracketFromSeason(season);
  const state = createTournamentState(bracket.teams.filter((team) => !isByeTeam(team)));
  const startRatings = new Map<string, number>();

  for (const [id, rating] of state.ratings) {
    startRatings.set(id, rating.rating);
  }

  for (const game of season.catalog.all) {
    const idx = matchIndex(game.round, game.slot, bracket.rounds);
    const match = bracket.matches[idx];
    const baseA = season.registry.require(game.teamAId);
    const baseB = season.registry.require(game.teamBId);
    const teamA: Team = {
      ...baseA,
      rating: state.ratings.get(game.teamAId)?.rating ?? baseA.rating,
    };
    const teamB: Team = {
      ...baseB,
      rating: state.ratings.get(game.teamBId)?.rating ?? baseB.rating,
    };

    const winnerIsA = game.winnerId === teamA.id;
    const isUpset = isRatingUpset(teamA.rating, teamB.rating, winnerIsA);

    recordGameResult(state, teamA, teamB, game.scoreA, game.scoreB, {
      round: game.round,
      totalRounds: bracket.rounds,
      margin: Math.abs(game.scoreA - game.scoreB),
      isUpset,
    }, model);

    match.teamA = teamA;
    match.teamB = teamB;
    match.winner = game.winnerId === teamA.id ? teamA : teamB;
  }

  const deltas: SeasonRatingDelta[] = season.teams.map((entry) => {
    const endRating = state.ratings.get(entry.id)?.rating ?? entry.rating;
    const startRating = startRatings.get(entry.id) ?? entry.rating;
    const team = season.registry.require(entry.id);
    return {
      team: {
        ...team,
        rating: endRating,
      },
      startRating,
      endRating,
      delta: endRating - startRating,
    };
  });

  deltas.sort((a, b) => b.delta - a.delta);

  return { state, deltas };
}

/** Estimate pre-tournament upset probability for a recorded game. */
export function preGameUpsetProbability(
  doc: SeasonDocument | Season,
  round: number,
  slot: number,
  options: UpsetOutlookOptions = {}
): number {
  const season = resolveSeason(doc);
  const game = season.catalog.requireAt(round, slot);
  const teamA = season.registry.require(game.teamAId);
  const teamB = season.registry.require(game.teamBId);

  const historicalWeight =
    options.historicalWeight ?? DEFAULT_HISTORICAL_WEIGHT;
  const forecast = forecastMatchupUpset(
    teamA,
    teamB,
    teamA.seed ?? null,
    teamB.seed ?? null,
    historicalWeight,
    round
  );

  if (forecast.upsetProbability === null) {
    throw new Error(`Cannot compute upset probability for BYE matchup at round ${round}, slot ${slot}`);
  }
  return forecast.upsetProbability;
}
