import { resolveSeasonFixturePath } from "./fixtureCatalog.js";
import { parseSeasonFile } from "./parseSeason.js";
import type { SeasonDocument } from "./types.js";

/** Resolve a path or catalog alias and parse the season JSON fixture. */
export function loadSeasonFixture(input: string): SeasonDocument {
  return parseSeasonFile(resolveSeasonFixturePath(input));
}
