import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadSeasonFixture } from "./loadFixture.js";

const FIXTURES = join(import.meta.dirname, "../../fixtures/seasons");

describe("loadSeasonFixture", () => {
  it("loads a bundled fixture by catalog id", () => {
    const doc = loadSeasonFixture("2023-east-mini");

    expect(doc.id).toBe("2023-east-mini");
    expect(doc.teams).toHaveLength(8);
    expect(doc.games).toHaveLength(7);
  });

  it("loads a bundled fixture by @-prefixed alias", () => {
    const doc = loadSeasonFixture("@2024-west-mini");

    expect(doc.id).toBe("2024-west-mini");
    expect(doc.year).toBe(2024);
  });

  it("loads a fixture from an explicit filesystem path", () => {
    const path = join(FIXTURES, "2024-title-game.json");
    const doc = loadSeasonFixture(path);

    expect(doc.id).toBe("2024-title-game");
    expect(doc.teams).toHaveLength(2);
  });

  it("trims whitespace from fixture references", () => {
    const doc = loadSeasonFixture("  @2023-west-mini  ");

    expect(doc.id).toBe("2023-west-mini");
  });

  it("throws for unknown fixture ids", () => {
    expect(() => loadSeasonFixture("missing-season-fixture")).toThrow(
      /Season fixture not found/
    );
  });
});
