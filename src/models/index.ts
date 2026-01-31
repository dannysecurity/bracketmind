export type {
  BracketSlot,
  GameResult,
  RecordedGame,
} from "./game.js";
export {
  bracketSlotKey,
  bracketSlotOf,
  sameBracketSlot,
} from "./game.js";
export {
  bracketGeometryForTeamCount,
  validateRecordedGames,
} from "./gameValidation.js";
export type { BracketGeometry } from "./gameValidation.js";
export type { CompletedGameScores } from "./bracketGame.js";
export {
  applyGameResultToMatch,
  gameResultFromMatch,
  gameResultFromRecordedGame,
  isCompletedMatch,
  recordedGameFromMatch,
  recordedGamesFromBracket,
  resolveWinner,
} from "./bracketGame.js";
export type {
  GameOutcomeFacts,
  ResolvedGameParticipants,
} from "./gameCatalog.js";
export {
  compareBracketSlots,
  GameCatalog,
  resolveGameOutcome,
  sortGamesBySlot,
} from "./gameCatalog.js";
export { TeamRegistry } from "./registry.js";
export type {
  Bracket,
  CompletedMatch,
  Match,
  MatchFrame,
  ReadyMatch,
} from "./match.js";
export {
  isReadyMatch,
  matchBracketSlot,
} from "./match.js";
export { Season } from "./season.js";
export type {
  RatedTeam,
  SeededTeam,
  Team,
  TeamId,
  TeamIdentity,
} from "./team.js";
export {
  isByeTeam,
  toRuntimeTeam,
  toSeededTeam,
} from "./team.js";
export {
  validateConsecutiveSeeds,
  validateSeededTeams,
  validateUniqueTeamIds,
} from "./teamValidation.js";
