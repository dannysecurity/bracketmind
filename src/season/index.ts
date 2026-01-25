export type { SeasonDocument, SeasonGame, SeasonTeam } from "./types.js";
export {
  seasonTeamToTeam,
  teamMapFromDocument,
  teamRegistryFromDocument,
  teamsFromDocument,
} from "./adapters.js";
export { parseSeasonFile, parseSeasonJson } from "./parseSeason.js";
export { loadSeasonFixture } from "./loadFixture.js";
export { validateSeasonDocument } from "./validateSeason.js";
export {
  createBracketFromSeason,
  matchIndex,
} from "./buildBracket.js";
export {
  hydrateBracketResults,
  loadSeasonBracket,
  getSeasonChampion,
} from "./hydrateResults.js";
export {
  replaySeasonRatings,
  preGameUpsetProbability,
  type SeasonRatingDelta,
  type SeasonRatingReplay,
} from "./replayRatings.js";
export {
  compareSeasonPredictions,
  type SeasonPredictionComparison,
} from "./comparePredictions.js";
export {
  summarizeSeason,
  type SeasonSummary,
} from "./summarizeSeason.js";
export {
  analyzeSeasonUpsets,
  type SeasonGameUpsetAnalysis,
} from "./analyzeUpsets.js";
export {
  bundledFixturesDir,
  listBundledFixtures,
  resolveSeasonFixturePath,
  type FixtureCatalogEntry,
} from "./fixtureCatalog.js";
