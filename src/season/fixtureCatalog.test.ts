import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { analyzeSeasonUpsets } from "./analyzeUpsets.js";
import {
  bundledFixturesDir,
  listBundledFixtures,
  resolveSeasonFixturePath,
} from "./fixtureCatalog.js";
import { loadSeasonBracket, getSeasonChampion } from "./hydrateResults.js";
import { parseSeasonFile } from "./parseSeason.js";
import { assertBracketSimulationInvariants } from "../testing/simulationFixtures.js";

const FIXTURES = join(import.meta.dirname, "../../fixtures/seasons");

describe("fixtureCatalog", () => {
  it("lists every bundled season fixture with metadata", () => {
    const entries = listBundledFixtures();

    expect(entries.length).toBeGreaterThanOrEqual(6);
    expect(entries.map((entry) => entry.id)).toContain("2024-south-region");
    expect(entries.map((entry) => entry.id)).toContain("2023-east-mini");
    expect(entries.every((entry) => entry.path.startsWith(bundledFixturesDir()))).toBe(
      true
    );
  });

  it("includes champion names for complete fixtures", () => {
    const entries = listBundledFixtures();
    const eastMini = entries.find((entry) => entry.id === "2023-east-mini");

    expect(eastMini?.championName).toBe("UConn");
    expect(entries.find((entry) => entry.id === "2024-south-region")?.championName).toBe(
      "Houston"
    );
  });

  it("resolves fixture ids and @-prefixed aliases", () => {
    const byId = resolveSeasonFixturePath("2024-east-mini");
    const byAlias = resolveSeasonFixturePath("@2024-east-mini");

    expect(byId).toBe(join(FIXTURES, "2024-east-mini.json"));
    expect(byAlias).toBe(byId);
  });

  it("resolves explicit filesystem paths unchanged", () => {
    const path = join(FIXTURES, "2024-title-game.json");
    expect(resolveSeasonFixturePath(path)).toBe(path);
  });

  it("throws for unknown fixture ids", () => {
    expect(() => resolveSeasonFixturePath("not-a-real-season")).toThrow(
      /Season fixture not found/
    );
  });
});

describe("2024-south-region fixture", () => {
  it("hydrates the full 16-team region bracket", () => {
    const doc = parseSeasonFile(join(FIXTURES, "2024-south-region.json"));
    const bracket = loadSeasonBracket(doc);

    expect(doc.teams).toHaveLength(16);
    expect(doc.games).toHaveLength(15);
    assertBracketSimulationInvariants(bracket);
    expect(getSeasonChampion(doc).name).toBe("Houston");
  });
});

describe("analyzeSeasonUpsets", () => {
  it("reports pre-game upset odds and actual upset flags per game", () => {
    const doc = parseSeasonFile(join(FIXTURES, "2023-midwest-final-four.json"));
    const analyses = analyzeSeasonUpsets(doc);

    expect(analyses).toHaveLength(doc.games.length);
    expect(analyses.every((game) => game.preGameUpsetProbability >= 0)).toBe(true);
    expect(analyses.some((game) => game.wasRatingUpset || game.wasSeedUpset)).toBe(
      true
    );
  });

  it("covers every recorded game in the south region fixture", () => {
    const doc = parseSeasonFile(join(FIXTURES, "2024-south-region.json"));
    const analyses = analyzeSeasonUpsets(doc);

    expect(analyses).toHaveLength(15);
    expect(analyses[0].teamA.name).toBe("Houston");
    expect(analyses.at(-1)?.winner.name).toBe("Houston");
  });
});
