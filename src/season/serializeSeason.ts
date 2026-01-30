import { sortGamesBySlot } from "../models/gameCatalog.js";
import { validateSeasonDocument } from "./validateSeason.js";
import type { SeasonDocument } from "./types.js";

/** Serialize a validated season document to stable, pretty-printed JSON. */
export function serializeSeasonDocument(doc: SeasonDocument): string {
  const validated = validateSeasonDocument(doc);
  const payload = {
    id: validated.id,
    name: validated.name,
    year: validated.year,
    teams: [...validated.teams].sort((a, b) => a.seed - b.seed),
    games: sortGamesBySlot(validated.games),
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}
