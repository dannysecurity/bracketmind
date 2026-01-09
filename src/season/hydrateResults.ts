import { getChampion } from "../bracket.js";
import type { Bracket } from "../types.js";
import { createBracketFromSeason, matchIndex } from "./buildBracket.js";
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

    const winner =
      game.winnerId === match.teamA.id ? match.teamA : match.teamB;

    match.scoreA = game.scoreA;
    match.scoreB = game.scoreB;
    match.winner = winner;

    if (game.round + 1 < working.rounds) {
      const nextIdx = matchIndex(
        game.round + 1,
        Math.floor(game.slot / 2),
        working.rounds
      );
      const nextMatch = working.matches[nextIdx];
      if (game.slot % 2 === 0) {
        nextMatch.teamA = winner;
      } else {
        nextMatch.teamB = winner;
      }
    }
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
