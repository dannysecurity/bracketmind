import { describe, expect, it, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseSeasonFile } from "./parseSeason.js";
import { serializeSeasonDocument } from "./serializeSeason.js";
import {
  defaultFixtureOutputPath,
  importSeasonFromFile,
  writeSeasonFixture,
} from "./writeFixture.js";

const FIXTURES = join(import.meta.dirname, "../../fixtures/seasons");

describe("writeSeasonFixture", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("writes a validated fixture to a custom directory", () => {
    tempDir = mkdtempSync(join(tmpdir(), "bracketmind-fixture-"));
    const doc = parseSeasonFile(join(FIXTURES, "2023-west-mini.json"));
    const outputPath = join(tempDir, `${doc.id}.json`);

    writeSeasonFixture(doc, outputPath);

    expect(existsSync(outputPath)).toBe(true);
    expect(parseSeasonFile(outputPath)).toEqual(doc);
  });

  it("refuses to overwrite unless forced", () => {
    tempDir = mkdtempSync(join(tmpdir(), "bracketmind-fixture-"));
    const doc = parseSeasonFile(join(FIXTURES, "2023-west-mini.json"));
    const outputPath = join(tempDir, `${doc.id}.json`);

    writeSeasonFixture(doc, outputPath);
    expect(() => writeSeasonFixture(doc, outputPath)).toThrow(/already exists/);

    writeSeasonFixture(doc, outputPath, { overwrite: true });
    expect(parseSeasonFile(outputPath)).toEqual(doc);
  });

  it("imports from an external path into the fixture directory", () => {
    tempDir = mkdtempSync(join(tmpdir(), "bracketmind-fixture-"));
    const doc = parseSeasonFile(join(FIXTURES, "2023-west-mini.json"));
    const sourcePath = join(tempDir, "external-season.json");
    writeFileSync(sourcePath, serializeSeasonDocument(doc), "utf8");

    const { outputPath } = importSeasonFromFile(sourcePath, {
      outputDir: tempDir,
    });

    expect(outputPath).toBe(defaultFixtureOutputPath(doc, tempDir));
    expect(parseSeasonFile(outputPath)).toEqual(doc);
  });

  it("imports a full Final Four historical season fixture", () => {
    tempDir = mkdtempSync(join(tmpdir(), "bracketmind-fixture-"));
    const doc = parseSeasonFile(join(FIXTURES, "2024-final-four.json"));
    const sourcePath = join(tempDir, "downloaded-final-four.json");
    writeFileSync(sourcePath, serializeSeasonDocument(doc), "utf8");

    const { doc: imported, outputPath } = importSeasonFromFile(sourcePath, {
      outputDir: tempDir,
    });

    expect(imported.id).toBe("2024-final-four");
    expect(outputPath).toBe(join(tempDir, "2024-final-four.json"));
    expect(parseSeasonFile(outputPath).games).toHaveLength(3);
  });
});
