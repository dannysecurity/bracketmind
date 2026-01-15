import {
  bracketPlacementOrder,
  buildInitialMatches,
  matchIndex,
  nextPowerOfTwo,
  padTeamsWithByes,
} from "../bracket/layout.js";
import type { Bracket } from "../types.js";
import { seasonTeamToTeam } from "./adapters.js";
import type { SeasonDocument } from "./types.js";

/** Build an empty bracket from a season document using official seeds for placement. */
export function createBracketFromSeason(doc: SeasonDocument): Bracket {
  const sortedBySeed = [...doc.teams].sort((a, b) => a.seed - b.seed);
  const teams = sortedBySeed.map(seasonTeamToTeam);
  const target = nextPowerOfTwo(teams.length);
  const seeded = padTeamsWithByes(teams);
  const placed = bracketPlacementOrder(seeded.length).map((index) => seeded[index]);
  const rounds = Math.log2(placed.length);

  return { teams: placed, matches: buildInitialMatches(placed, rounds), rounds };
}

export { matchIndex };
