import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bundledFixturesDir } from "./fixtureCatalog.js";
import { parseSeasonFile } from "./parseSeason.js";
import { serializeSeasonDocument } from "./serializeSeason.js";
import { validateSeasonDocument } from "./validateSeason.js";
import type { SeasonDocument } from "./types.js";

export interface WriteSeasonFixtureOptions {
  overwrite?: boolean;
}

export interface ImportSeasonFixtureOptions extends WriteSeasonFixtureOptions {
  outputDir?: string;
}

/** Default on-disk path for a season fixture id. */
export function defaultFixtureOutputPath(
  doc: SeasonDocument,
  outputDir?: string
): string {
  const dir = outputDir ?? bundledFixturesDir();
  return join(dir, `${doc.id}.json`);
}

/** Write a validated season document to disk as JSON. */
export function writeSeasonFixture(
  doc: SeasonDocument,
  outputPath: string,
  options?: WriteSeasonFixtureOptions
): void {
  const validated = validateSeasonDocument(doc);

  if (existsSync(outputPath) && !options?.overwrite) {
    throw new Error(
      `Fixture already exists: ${outputPath}. Pass --force to overwrite.`
    );
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serializeSeasonDocument(validated), "utf8");
}

/** Read an external season JSON file and persist it to the fixture catalog directory. */
export function importSeasonFromFile(
  inputPath: string,
  options?: ImportSeasonFixtureOptions
): { doc: SeasonDocument; outputPath: string } {
  const doc = parseSeasonFile(inputPath);
  const outputPath = defaultFixtureOutputPath(doc, options?.outputDir);
  writeSeasonFixture(doc, outputPath, { overwrite: options?.overwrite });
  return { doc, outputPath };
}
