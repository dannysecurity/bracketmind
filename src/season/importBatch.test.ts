import { describe, expect, it, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  discoverSeasonFixtureFiles,
  importSeasonBatchFromDirectory,
} from "./importBatch.js";
import { parseSeasonFile } from "./parseSeason.js";
import { serializeSeasonDocument } from "./serializeSeason.js";

const FIXTURES = join(import.meta.dirname, "../../fixtures/seasons");

describe("discoverSeasonFixtureFiles", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("lists sorted JSON files in a directory", () => {
    const files = discoverSeasonFixtureFiles(FIXTURES);
    expect(files.length).toBeGreaterThanOrEqual(8);
    expect(files.every((path) => path.endsWith(".json"))).toBe(true);
    expect(files).toEqual([...files].sort());
  });

  it("includes uppercase .JSON extensions", () => {
    tempDir = mkdtempSync(join(tmpdir(), "bracketmind-json-ext-"));
    const sourceDir = join(tempDir, "source");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, "season.JSON"), "{}", "utf8");
    writeFileSync(join(sourceDir, "readme.txt"), "skip", "utf8");

    const files = discoverSeasonFixtureFiles(sourceDir);
    expect(files).toEqual([join(sourceDir, "season.JSON")]);
  });

  it("rejects missing directories", () => {
    expect(() =>
      discoverSeasonFixtureFiles(join(FIXTURES, "missing-dir"))
    ).toThrow(/Directory not found/);
  });
});

describe("importSeasonBatchFromDirectory", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("dry-runs every valid season JSON in a source directory", () => {
    tempDir = mkdtempSync(join(tmpdir(), "bracketmind-batch-src-"));
    const sourceDir = join(tempDir, "source");
    const outDir = join(tempDir, "out");
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });

    const docA = parseSeasonFile(join(FIXTURES, "2023-west-mini.json"));
    const docB = parseSeasonFile(join(FIXTURES, "2024-title-game.json"));
    writeFileSync(
      join(sourceDir, "a-season.json"),
      serializeSeasonDocument(docA),
      "utf8"
    );
    writeFileSync(
      join(sourceDir, "b-season.json"),
      serializeSeasonDocument(docB),
      "utf8"
    );

    const result = importSeasonBatchFromDirectory(sourceDir, {
      outputDir: outDir,
      dryRun: true,
    });

    expect(result.results).toHaveLength(2);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results.every((entry) => entry.status === "dry-run")).toBe(
      true
    );
    expect(existsSync(join(outDir, "2023-west-mini.json"))).toBe(false);
  });

  it("imports multiple fixtures and skips existing files without --force", () => {
    tempDir = mkdtempSync(join(tmpdir(), "bracketmind-batch-write-"));
    const sourceDir = join(tempDir, "source");
    const outDir = join(tempDir, "out");
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });

    const docA = parseSeasonFile(join(FIXTURES, "2023-east-mini.json"));
    const docB = parseSeasonFile(join(FIXTURES, "2024-west-mini.json"));
    writeFileSync(
      join(sourceDir, "first.json"),
      serializeSeasonDocument(docA),
      "utf8"
    );
    writeFileSync(
      join(sourceDir, "second.json"),
      serializeSeasonDocument(docB),
      "utf8"
    );

    const firstPass = importSeasonBatchFromDirectory(sourceDir, {
      outputDir: outDir,
    });
    expect(firstPass.imported).toBe(2);
    expect(firstPass.failed).toBe(0);
    expect(parseSeasonFile(join(outDir, "2023-east-mini.json"))).toEqual(docA);
    expect(parseSeasonFile(join(outDir, "2024-west-mini.json"))).toEqual(docB);

    const secondPass = importSeasonBatchFromDirectory(sourceDir, {
      outputDir: outDir,
    });
    expect(secondPass.imported).toBe(0);
    expect(secondPass.skipped).toBe(2);
    expect(secondPass.results.every((entry) => entry.status === "skipped")).toBe(
      true
    );
  });

  it("records validation failures without aborting the batch", () => {
    tempDir = mkdtempSync(join(tmpdir(), "bracketmind-batch-fail-"));
    const sourceDir = join(tempDir, "source");
    const outDir = join(tempDir, "out");
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });

    const doc = parseSeasonFile(join(FIXTURES, "2024-title-game.json"));
    writeFileSync(
      join(sourceDir, "good.json"),
      serializeSeasonDocument(doc),
      "utf8"
    );
    writeFileSync(join(sourceDir, "bad.json"), "{ not valid season json", "utf8");

    const result = importSeasonBatchFromDirectory(sourceDir, {
      outputDir: outDir,
    });

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results.find((entry) => entry.status === "failed")?.error).toBeTruthy();
    expect(existsSync(join(outDir, "2024-title-game.json"))).toBe(true);
  });
});
