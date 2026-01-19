import {
  bracketPlacementOrder,
  buildInitialMatches,
  padTeamsWithByes,
} from "../bracket/layout.js";
import type { Bracket, Team } from "../types.js";
import { orderTeamsForBracket } from "./teams.js";
import type { BracketOrdering } from "./types.js";

export interface BuildBracketOptions {
  /** Defaults to rating-based ordering for ad-hoc CLI brackets. */
  ordering?: BracketOrdering;
}

/** Build a single-elimination bracket with configurable team ordering. */
export function buildBracket(
  teams: Team[],
  options: BuildBracketOptions = {}
): Bracket {
  const ordering = options.ordering ?? "rating";

  if (teams.length < 2) {
    throw new Error("At least two teams are required");
  }

  const ordered = orderTeamsForBracket(teams, ordering);
  const seeded = padTeamsWithByes(ordered);
  const placed = bracketPlacementOrder(seeded.length).map((index) => seeded[index]);
  const rounds = Math.log2(placed.length);

  return { teams: placed, matches: buildInitialMatches(placed, rounds), rounds };
}
