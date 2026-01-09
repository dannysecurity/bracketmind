import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertBracketSimulationInvariants } from "../testing/simulationFixtures.js";
import { compareSeasonPredictions } from "./comparePredictions.js";
import { createBracketFromSeason, matchIndex } from "./buildBracket.js";
import {
  getSeasonChampion,
  hydrateBracketResults,
  loadSeasonBracket,
} from "./hydrateResults.js";
import { parseSeasonFile, parseSeasonJson } from "./parseSeason.js";
import { preGameUpsetProbability, replaySeasonRatings } from "./replayRatings.js";
import { validateSeasonDocument } from "./validateSeason.js";
import type { SeasonDocument } from "./types.js";

const FIXTURES = join(import.meta.dirname, "../../fixtures/seasons");

function loadFixture(name: string): SeasonDocument {
  return parseSeasonFile(join(FIXTURES, name));
}

describe("validateSeasonDocument", () => {
  it("rejects documents with duplicate team ids", () => {
    expect(() =>
      validateSeasonDocument({
        id: "bad",
        name: "Bad",
        year: 2024,
        teams: [
          { id: "a", name: "A", seed: 1, rating: 1600 },
          { id: "a", name: "B", seed: 2, rating: 1500 },
        ],
        games: [],
      })
    ).toThrow(/Duplicate team id/);
  });

  it("rejects non-consecutive seeds", () => {
    expect(() =>
      validateSeasonDocument({
        id: "bad",
        name: "Bad",
        year: 2024,
        teams: [
          { id: "a", name: "A", seed: 1, rating: 1600 },
          { id: "b", name: "B", seed: 3, rating: 1500 },
        ],
        games: [],
      })
    ).toThrow(/consecutive integers/);
  });
});

describe("parseSeasonJson", () => {
  it("loads the 2024 east mini fixture from disk", () => {
    const doc = loadFixture("2024-east-mini.json");
    expect(doc.teams).toHaveLength(8);
    expect(doc.games).toHaveLength(7);
  });
});

describe("loadSeasonBracket", () => {
  it("hydrates an 8-team bracket with official seed placement", () => {
    const doc = loadFixture("2024-east-mini.json");
    const bracket = loadSeasonBracket(doc);

    const roundZero = bracket.matches.filter((match) => match.round === 0);
    expect(roundZero[0].teamA?.name).toBe("UConn");
    expect(roundZero[0].teamB?.name).toBe("Florida Atlantic");
    expect(roundZero[2].teamA?.name).toBe("Iowa State");
    expect(roundZero[2].teamB?.name).toBe("Washington State");

    assertBracketSimulationInvariants(bracket);
    expect(getSeasonChampion(doc).name).toBe("UConn");
  });

  it("hydrates the 2023 four-team upset bracket", () => {
    const doc = loadFixture("2023-midwest-final-four.json");
    const bracket = loadSeasonBracket(doc);

    assertBracketSimulationInvariants(bracket);
    expect(getSeasonChampion(doc).name).toBe("Purdue");
  });

  it("throws when game teams do not match bracket placement", () => {
    const doc = loadFixture("2024-east-mini.json");
    const bracket = createBracketFromSeason(doc);
    const badGames = structuredClone(doc.games);
    badGames[0] = { ...badGames[0], teamAId: "illinois" };

    expect(() => hydrateBracketResults(bracket, badGames)).toThrow(/teams mismatch/);
  });
});

describe("matchIndex", () => {
  it("maps round and slot to flat match indices", () => {
    expect(matchIndex(0, 0, 3)).toBe(0);
    expect(matchIndex(1, 0, 3)).toBe(4);
    expect(matchIndex(2, 0, 3)).toBe(6);
  });
});

describe("replaySeasonRatings", () => {
  it("updates ratings after replaying recorded games", () => {
    const doc = loadFixture("2023-midwest-final-four.json");
    const { deltas } = replaySeasonRatings(doc);
    const champion = deltas.find((entry) => entry.team.name === "Purdue")!;

    expect(champion.delta).toBeGreaterThan(0);
    expect(deltas.some((entry) => entry.delta < 0)).toBe(true);
  });
});

describe("compareSeasonPredictions", () => {
  it("returns actual champion and predicted rates", () => {
    const doc = loadFixture("2023-midwest-final-four.json");
    const comparison = compareSeasonPredictions(doc, 100);

    expect(comparison.actualChampion.name).toBe("Purdue");
    expect(comparison.predictedRates.size).toBe(4);
    expect(comparison.iterations).toBe(100);
  });
});

describe("preGameUpsetProbability", () => {
  it("estimates upset odds for a recorded first-round game", () => {
    const doc = loadFixture("2023-midwest-final-four.json");
    const upsetProb = preGameUpsetProbability(doc, 0, 0);

    expect(upsetProb).toBeGreaterThan(0);
    expect(upsetProb).toBeLessThan(1);
  });
});

describe("round-trip fixture integrity", () => {
  it("preserves JSON fixtures through parse and stringify", () => {
    for (const file of ["2024-east-mini.json", "2023-midwest-final-four.json"]) {
      const raw = readFileSync(join(FIXTURES, file), "utf8");
      const doc = parseSeasonJson(raw);
      expect(doc.id).toBeTruthy();
      loadSeasonBracket(doc);
    }
  });
});
