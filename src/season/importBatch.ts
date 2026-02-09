import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { parseSeasonFile } from "./parseSeason.js";
import { summarizeSeason } from "./summarizeSeason.js";
import type { SeasonSummary } from "./summarizeSeason.js";
import type { SeasonDocument } from "./types.js";
import {
  defaultFixtureOutputPath,
  importSeasonFromFile,
  type ImportSeasonFixtureOptions,
} from "./writeFixture.js";

/** Outcome of importing one season JSON file in a batch. */
export interface SeasonFixtureImportResult {
  inputPath: string;
  status: "imported" | "dry-run" | "skipped" | "failed";
  doc?: SeasonDocument;
  summary?: SeasonSummary;
  outputPath?: string;
  error?: string;
}

export interface ImportSeasonBatchOptions extends ImportSeasonFixtureOptions {
  dryRun?: boolean;
}

export interface ImportSeasonBatchResult {
  inputDir: string;
  results: SeasonFixtureImportResult[];
  imported: number;
  skipped: number;
  failed: number;
}

/** List season JSON files in a directory (non-recursive), sorted by filename. */
export function discoverSeasonFixtureFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    throw new Error(`Directory not found: ${directory}`);
  }

  const stats = statSync(directory);
  if (!stats.isDirectory()) {
    throw new Error(`Not a directory: ${directory}`);
  }

  return readdirSync(directory)
    .filter((name) => extname(name).toLowerCase() === ".json")
    .sort()
    .map((name) => join(directory, name));
}

function isExistingFixtureError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("already exists");
}

/** Validate and import every season JSON file in a directory. */
export function importSeasonBatchFromDirectory(
  inputDir: string,
  options?: ImportSeasonBatchOptions
): ImportSeasonBatchResult {
  const files = discoverSeasonFixtureFiles(inputDir);
  const results: SeasonFixtureImportResult[] = [];
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const inputPath of files) {
    try {
      const doc = parseSeasonFile(inputPath);
      const summary = summarizeSeason(doc);
      const outputPath = defaultFixtureOutputPath(doc, options?.outputDir);

      if (options?.dryRun) {
        results.push({
          inputPath,
          status: "dry-run",
          doc,
          summary,
          outputPath,
        });
        imported++;
        continue;
      }

      try {
        const { outputPath: writtenPath } = importSeasonFromFile(inputPath, options);
        results.push({
          inputPath,
          status: "imported",
          doc,
          summary,
          outputPath: writtenPath,
        });
        imported++;
      } catch (writeError) {
        if (!options?.overwrite && isExistingFixtureError(writeError)) {
          results.push({
            inputPath,
            status: "skipped",
            doc,
            summary,
            outputPath,
            error:
              writeError instanceof Error ? writeError.message : String(writeError),
          });
          skipped++;
        } else {
          throw writeError;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        inputPath,
        status: "failed",
        error: message,
      });
      failed++;
    }
  }

  return { inputDir, results, imported, skipped, failed };
}
