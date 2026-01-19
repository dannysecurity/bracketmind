import { isRatingUpset } from "../ratings.js";
import { teamMapFromDocument } from "./adapters.js";
import { preGameUpsetProbability } from "./replayRatings.js";
import type { SeasonDocument } from "./types.js";
import type { Team } from "../types.js";

export interface SeasonGameUpsetAnalysis {
  round: number;
  slot: number;
  teamA: Team;
  teamB: Team;
  winner: Team;
  scoreA: number;
  scoreB: number;
  preGameUpsetProbability: number;
  wasRatingUpset: boolean;
  wasSeedUpset: boolean;
}

/** Analyze each recorded game for pre-game upset odds and actual upset outcomes. */
export function analyzeSeasonUpsets(doc: SeasonDocument): SeasonGameUpsetAnalysis[] {
  const teamById = teamMapFromDocument(doc);
  const seedById = new Map(doc.teams.map((team) => [team.id, team.seed]));

  const sorted = [...doc.games].sort((a, b) =>
    a.round === b.round ? a.slot - b.slot : a.round - b.round
  );

  return sorted.map((game) => {
    const teamA = teamById.get(game.teamAId)!;
    const teamB = teamById.get(game.teamBId)!;
    const winner = teamById.get(game.winnerId)!;
    const winnerIsA = game.winnerId === game.teamAId;
    const loserId = winnerIsA ? game.teamBId : game.teamAId;
    const winnerSeed = seedById.get(game.winnerId)!;
    const loserSeed = seedById.get(loserId)!;

    return {
      round: game.round,
      slot: game.slot,
      teamA,
      teamB,
      winner,
      scoreA: game.scoreA,
      scoreB: game.scoreB,
      preGameUpsetProbability: preGameUpsetProbability(doc, game.round, game.slot),
      wasRatingUpset: isRatingUpset(teamA.rating, teamB.rating, winnerIsA),
      wasSeedUpset: winnerSeed > loserSeed,
    };
  });
}
