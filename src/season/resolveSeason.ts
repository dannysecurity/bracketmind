import { Season } from "../models/season.js";
import type { SeasonDocument } from "./types.js";

/** Normalize a season document or composed model into a Season instance. */
export function resolveSeason(input: SeasonDocument | Season): Season {
  return "registry" in input ? input : Season.fromDocument(input);
}
