import { matchIndex } from "../bracket/layout.js";
import { buildBracket } from "../domain/buildBracket.js";
import type { Bracket } from "../types.js";
import { teamsFromDocument } from "./adapters.js";
import type { SeasonDocument } from "./types.js";

/** Build an empty bracket from a season document using official seeds for placement. */
export function createBracketFromSeason(doc: SeasonDocument): Bracket {
  return buildBracket(teamsFromDocument(doc), { ordering: "seed" });
}

export { matchIndex };
