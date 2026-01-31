import { getChampion } from "../bracket.js";
import { matchIndex } from "../bracket/layout.js";
import { advanceWinner } from "../domain/advanceWinner.js";
import { applyGameResultToMatch } from "../models/bracketGame.js";
import type { Season } from "../models/season.js";
import type { Bracket } from "../types.js";
import { seasonFromDocument } from "./adapters.js";
import { createBracketFromSeason } from "./buildBracket.js";
import type { SeasonDocument } from "./types.js";

function resolveSeason(input: SeasonDocument | Season): Season {
  return "registry" in input ? input : seasonFromDocument(input);
}

/** Apply recorded game results to a bracket without simulation. */
export function hydrateBracketResults(
  bracket: Bracket,
  season: SeasonDocument | Season
): Bracket {
  const model = resolveSeason(season);
  const working = structuredClone(bracket);

  for (const game of model.catalog.all) {
    const idx = matchIndex(game.round, game.slot, working.rounds);
    const match = working.matches[idx];

    if (!match.teamA || !match.teamB) {
      throw new Error(
        `Cannot hydrate round ${game.round}, slot ${game.slot}: teams not yet assigned`
      );
    }

    if (match.teamA.id !== game.teamAId || match.teamB.id !== game.teamBId) {
      throw new Error(
        `Game teams mismatch at round ${game.round}, slot ${game.slot}: ` +
          `expected ${match.teamA.id} vs ${match.teamB.id}, ` +
          `got ${game.teamAId} vs ${game.teamBId}`
      );
    }

    const winner = applyGameResultToMatch(match, match.teamA, match.teamB, game);
    advanceWinner(working, game.round, game.slot, winner);
  }

  return working;
}

/** Parse a season document into a fully hydrated bracket with recorded results. */
export function loadSeasonBracket(doc: SeasonDocument | Season): Bracket {
  const model = resolveSeason(doc);
  const bracket = createBracketFromSeason(model);
  return hydrateBracketResults(bracket, model);
}

/** Return the champion from a hydrated season bracket. */
export function getSeasonChampion(doc: SeasonDocument | Season) {
  return getChampion(loadSeasonBracket(doc));
}
