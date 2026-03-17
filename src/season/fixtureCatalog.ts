import { existsSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { parseSeasonFile } from "./parseSeason.js";
import { summarizeSeason } from "./summarizeSeason.js";
import type { SeasonDocument } from "./types.js";

/** Metadata for a bundled historical season JSON fixture. */
export interface FixtureCatalogEntry {
  id: string;
  filename: string;
  path: string;
  name: string;
  year: number;
  teamCount: number;
  gameCount: number;
  championName?: string;
}

const BUNDLED_FIXTURES_DIR = join(import.meta.dirname, "../../fixtures/seasons");

/** True when a filename has a `.json` extension (case-insensitive). */
export function isSeasonJsonFilename(name: string): boolean {
  return extname(name).toLowerCase() === ".json";
}

/** Directory containing shipped season JSON fixtures. */
export function bundledFixturesDir(): string {
  return BUNDLED_FIXTURES_DIR;
}

/** List every bundled season fixture with summary metadata. */
export function listBundledFixtures(): FixtureCatalogEntry[] {
  const filenames = readdirSync(BUNDLED_FIXTURES_DIR)
    .filter(isSeasonJsonFilename)
    .sort();

  return filenames.map((filename) => {
    const path = join(BUNDLED_FIXTURES_DIR, filename);
    const doc = parseSeasonFile(path);
    return catalogEntryFromDocument(doc, filename, path);
  });
}

function catalogEntryFromDocument(
  doc: SeasonDocument,
  filename: string,
  path: string
): FixtureCatalogEntry {
  const summary = summarizeSeason(doc);

  return {
    id: doc.id,
    filename,
    path,
    name: doc.name,
    year: doc.year,
    teamCount: doc.teams.length,
    gameCount: doc.games.length,
    championName: summary.championName,
  };
}

/** Resolve a fixture path, catalog id, or @-prefixed alias to an on-disk JSON file. */
export function resolveSeasonFixturePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Season fixture path is required");
  }

  if (existsSync(trimmed)) {
    return trimmed;
  }

  const alias = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const filename = isSeasonJsonFilename(alias) ? alias : `${alias}.json`;

  const cwdCandidate = join(process.cwd(), filename);
  if (existsSync(cwdCandidate)) {
    return cwdCandidate;
  }

  const bundledCandidate = join(BUNDLED_FIXTURES_DIR, basename(filename));
  if (existsSync(bundledCandidate)) {
    return bundledCandidate;
  }

  const entries = listBundledFixtures();
  const byId = entries.find((entry) => entry.id === alias);
  if (byId) {
    return byId.path;
  }

  throw new Error(
    `Season fixture not found: ${input}. Use "bracketmind import list" to see bundled fixtures.`
  );
}
