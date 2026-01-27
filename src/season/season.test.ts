import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildBracketView } from "../display/bracketView.js";
import { buildBracket } from "../domain/buildBracket.js";
import { assertBracketSimulationInvariants } from "../testing/simulationFixtures.js";
import { compareSeasonPredictions } from "./comparePredictions.js";
import { teamsFromDocument } from "./adapters.js";
import { createBracketFromSeason, matchIndex } from "./buildBracket.js";
import {
  getSeasonChampion,
  hydrateBracketResults,
  loadSeasonBracket,
} from "./hydrateResults.js";
import { loadSeasonFixture } from "./loadFixture.js";
import { parseSeasonFile, parseSeasonJson } from "./parseSeason.js";
import { preGameUpsetProbability, replaySeasonRatings } from "./replayRatings.js";
import { summarizeSeason } from "./summarizeSeason.js";
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

  it("loads bundled fixtures by catalog alias", () => {
    const doc = loadSeasonFixture("@2023-east-mini");
    expect(doc.id).toBe("2023-east-mini");
    expect(doc.teams).toHaveLength(8);
  });
});

describe("loadSeasonBracket", () => {
  it("preserves official seeds in the display view when rating order differs", () => {
    const doc = loadFixture("2023-midwest-final-four.json");
    const bracket = loadSeasonBracket(doc);
    const view = buildBracketView(bracket);
    const roundZero = view.matchesByRound[0];
    const purdueSlot = roundZero.find(
      (match) => match.teamA?.name === "Purdue" || match.teamB?.name === "Purdue"
    );
    const purdue = purdueSlot?.teamA?.name === "Purdue" ? purdueSlot.teamA : purdueSlot?.teamB;

    expect(purdue?.seed).toBe(4);
  });

  it("hydrates the 2023 east mini bracket with UConn as champion", () => {
    const doc = loadFixture("2023-east-mini.json");
    const bracket = loadSeasonBracket(doc);

    assertBracketSimulationInvariants(bracket);
    expect(getSeasonChampion(doc).name).toBe("UConn");
  });

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

  it("hydrates a minimal two-team championship fixture", () => {
    const doc = loadFixture("2024-title-game.json");
    const bracket = loadSeasonBracket(doc);

    expect(bracket.matches).toHaveLength(1);
    expect(bracket.matches[0].teamA?.name).toBe("UConn");
    expect(bracket.matches[0].teamB?.name).toBe("Purdue");
    assertBracketSimulationInvariants(bracket);
    expect(getSeasonChampion(doc).name).toBe("UConn");
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
  it("re-exports layout matchIndex for season hydration", () => {
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

  it("uses official seed placement for season prediction simulations", () => {
    const doc = loadFixture("2023-midwest-final-four.json");
    const teams = teamsFromDocument(doc);
    const bySeed = buildBracket(teams, { ordering: "seed" });
    const byRating = buildBracket(teams, { ordering: "rating" });

    expect(bySeed.matches[0].teamB?.id).toBe("purdue");
    expect(byRating.matches[0].teamB?.id).toBe("xavier");
    expect(createBracketFromSeason(doc).matches[0].teamB?.id).toBe("purdue");
  });
});

describe("preGameUpsetProbability", () => {
  it("estimates upset odds for a recorded first-round game", () => {
    const doc = loadFixture("2023-midwest-final-four.json");
    const upsetProb = preGameUpsetProbability(doc, 0, 0);

    expect(upsetProb).toBeGreaterThan(0);
    expect(upsetProb).toBeLessThan(1);
  });

  it("blends official seeds with Elo for later-round recorded games", () => {
    const doc = loadFixture("2024-east-mini.json");
    const blended = preGameUpsetProbability(doc, 1, 0);
    const eloOnly = preGameUpsetProbability(doc, 1, 0, {
      historicalWeight: 0,
    });

    expect(blended).not.toBe(eloOnly);
    expect(blended).toBeGreaterThan(0);
    expect(blended).toBeLessThan(1);
  });
});

describe("summarizeSeason", () => {
  it("reports a complete fixture with champion and upsets", () => {
    const doc = loadFixture("2024-west-mini.json");
    const summary = summarizeSeason(doc);

    expect(summary.isComplete).toBe(true);
    expect(summary.expectedGames).toBe(7);
    expect(summary.recordedGames).toBe(7);
    expect(summary.championName).toBe("North Carolina");
    expect(summary.seedUpsets).toBeGreaterThan(0);
  });

  it("flags partial fixtures missing later rounds", () => {
    const doc = loadFixture("2024-east-mini.json");
    const partial = {
      ...doc,
      games: doc.games.filter((game) => game.round === 0),
    };
    const summary = summarizeSeason(partial);

    expect(summary.isComplete).toBe(false);
    expect(summary.recordedGames).toBe(4);
    expect(summary.expectedGames).toBe(7);
    expect(summary.championName).toBeUndefined();
  });
});

describe("round-trip fixture integrity", () => {
  it("preserves JSON fixtures through parse and stringify", () => {
    for (const file of [
      "2023-east-mini.json",
      "2024-east-mini.json",
      "2023-midwest-final-four.json",
      "2024-title-game.json",
      "2024-west-mini.json",
      "2024-south-region.json",
    ]) {
      const raw = readFileSync(join(FIXTURES, file), "utf8");
      const doc = parseSeasonJson(raw);
      expect(doc.id).toBeTruthy();
      loadSeasonBracket(doc);
    }
  });
});
