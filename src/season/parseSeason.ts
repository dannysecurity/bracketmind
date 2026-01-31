import { readFileSync } from "node:fs";
import { Season } from "../models/season.js";
import { validateSeasonDocument } from "./validateSeason.js";
import type { SeasonDocument } from "./types.js";

/** Parse a season JSON string into a validated document. */
export function parseSeasonJson(json: string): SeasonDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON: ${message}`);
  }

  return validateSeasonDocument(raw);
}

/** Parse a season JSON string into a composed season model. */
export function parseSeason(json: string): Season {
  return Season.fromDocument(parseSeasonJson(json));
}

/** Read and parse a season fixture from disk. */
export function parseSeasonFile(path: string): SeasonDocument {
  const json = readFileSync(path, "utf8");
  return parseSeasonJson(json);
}

/** Read and load a composed season model from disk. */
export function loadSeasonFile(path: string): Season {
  return Season.fromDocument(parseSeasonFile(path));
}
