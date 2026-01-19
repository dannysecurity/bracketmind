import { getChampion } from "../bracket.js";
import { matchIndex } from "../bracket/layout.js";
import { advanceWinner } from "../domain/advanceWinner.js";
import { applyGameResultToMatch } from "../domain/gameResults.js";
import type { Bracket } from "../types.js";
import { createBracketFromSeason } from "./buildBracket.js";
import type { SeasonDocument, SeasonGame } from "./types.js";

/** Apply recorded game results to a bracket without simulation. */
export function hydrateBracketResults(
  bracket: Bracket,
  games: SeasonGame[]
): Bracket {
  const working = structuredClone(bracket);
  const sorted = [...games].sort((a, b) =>
    a.round === b.round ? a.slot - b.slot : a.round - b.round
  );

  for (const game of sorted) {
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
export function loadSeasonBracket(doc: SeasonDocument): Bracket {
  const bracket = createBracketFromSeason(doc);
  return hydrateBracketResults(bracket, doc.games);
}

/** Return the champion from a hydrated season bracket. */
export function getSeasonChampion(doc: SeasonDocument) {
  return getChampion(loadSeasonBracket(doc));
}
