import { isRatingUpset } from "../ratings.js";
import { GameCatalog, resolveGameOutcome } from "../models/gameCatalog.js";
import { teamRegistryFromDocument } from "./adapters.js";
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
  const registry = teamRegistryFromDocument(doc);
  const catalog = GameCatalog.fromGames(doc.games);

  return catalog.all.map((game) => {
    const outcome = resolveGameOutcome(game, registry);

    return {
      round: game.round,
      slot: game.slot,
      teamA: outcome.teamA,
      teamB: outcome.teamB,
      winner: outcome.winner,
      scoreA: game.scoreA,
      scoreB: game.scoreB,
      preGameUpsetProbability: preGameUpsetProbability(doc, game.round, game.slot),
      wasRatingUpset: isRatingUpset(
        outcome.teamA.rating,
        outcome.teamB.rating,
        outcome.winnerIsA
      ),
      wasSeedUpset: outcome.winnerSeed > outcome.loserSeed,
    };
  });
}
