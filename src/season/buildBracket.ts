import { matchIndex } from "../bracket/layout.js";
import { buildBracket } from "../domain/buildBracket.js";
import type { Season } from "../models/season.js";
import type { Bracket } from "../types.js";
import { seasonFromDocument } from "./adapters.js";
import type { SeasonDocument } from "./types.js";

/** Build an empty bracket from a season using official seeds for placement. */
export function createBracketFromSeason(doc: SeasonDocument | Season): Bracket {
  const season = "registry" in doc ? doc : seasonFromDocument(doc);
  return buildBracket(season.toRuntimeTeams(), { ordering: "seed" });
}

export { matchIndex };
