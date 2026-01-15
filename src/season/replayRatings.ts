import { isRatingUpset } from "../ratings.js";
import { matchupUpsetProbability } from "../probability/matchup.js";
import { createTournamentState, recordGameResult } from "../tournamentState.js";
import type { Team, TournamentState } from "../types.js";
import { isByeTeam } from "../types.js";
import { teamMapFromDocument } from "./adapters.js";
import { createBracketFromSeason, matchIndex } from "./buildBracket.js";
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
export function replaySeasonRatings(doc: SeasonDocument): SeasonRatingReplay {
  const bracket = createBracketFromSeason(doc);
  const state = createTournamentState(bracket.teams.filter((team) => !isByeTeam(team)));
  const startRatings = new Map<string, number>();

  for (const [id, rating] of state.ratings) {
    startRatings.set(id, rating.rating);
  }

  const sorted = [...doc.games].sort((a, b) =>
    a.round === b.round ? a.slot - b.slot : a.round - b.round
  );

  const teamById = teamMapFromDocument(doc);

  for (const game of sorted) {
    const idx = matchIndex(game.round, game.slot, bracket.rounds);
    const match = bracket.matches[idx];
    const baseA = teamById.get(game.teamAId)!;
    const baseB = teamById.get(game.teamBId)!;
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
    });

    match.teamA = teamA;
    match.teamB = teamB;
    match.winner = game.winnerId === teamA.id ? teamA : teamB;
  }

  const deltas: SeasonRatingDelta[] = doc.teams.map((entry) => {
    const endRating = state.ratings.get(entry.id)?.rating ?? entry.rating;
    const startRating = startRatings.get(entry.id) ?? entry.rating;
    const team = teamById.get(entry.id)!;
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
  doc: SeasonDocument,
  round: number,
  slot: number
): number {
  const game = doc.games.find((entry) => entry.round === round && entry.slot === slot);
  if (!game) {
    throw new Error(`No game at round ${round}, slot ${slot}`);
  }

  const teamById = teamMapFromDocument(doc);
  const teamA = teamById.get(game.teamAId)!;
  const teamB = teamById.get(game.teamBId)!;

  const upsetProb = matchupUpsetProbability(teamA, teamB);
  if (upsetProb === null) {
    throw new Error(`Cannot compute upset probability for BYE matchup at round ${round}, slot ${slot}`);
  }
  return upsetProb;
}
