import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  computeActualScores,
  updateTeamRatingsWithContext,
} from "./eloUpdates.js";
import { createTeamRating } from "./ratings.js";
import {
  createRatingModel,
  defaultRatingModel,
} from "./ratingsModel.js";
import { parseSeasonFile } from "./season/parseSeason.js";
import { replaySeasonRatings } from "./season/replayRatings.js";
import {
  calibrateAllFixtures,
  calibrateRatingModel,
  summarizeCalibration,
} from "./season/calibrateRatings.js";

const FIXTURES = join(import.meta.dirname, "../fixtures/seasons");

describe("defaultRatingModel", () => {
  it("matches legacy Elo tuning constants", () => {
    const model = defaultRatingModel();
    expect(model).toEqual({
      defaultRating: 1500,
      baseKFactor: 32,
      movCap: 20,
      upsetBonus: 0.08,
      provisionalThreshold: 10,
      provisionalKMultiplier: 1.25,
      establishedThreshold: 30,
      establishedKMultiplier: 0.8,
      roundKMin: 0.9,
      roundKRange: 0.3,
      initialRatingDeviation: 110,
      minRatingDeviation: 50,
      rdDecayPerGame: 3,
      rdKMin: 0.92,
      rdKRange: 0.08,
      formMomentumDecay: 0.6,
      formKRange: 0.06,
      seedKWeight: 0.35,
      seedKUpsetBoostMax: 0.18,
      seedKExpectedWinDampen: 0.05,
    });
  });
});

describe("createRatingModel", () => {
  it("overrides selected fields while preserving defaults elsewhere", () => {
    const model = createRatingModel({ upsetBonus: 0.15, baseKFactor: 24 });
    expect(model.upsetBonus).toBe(0.15);
    expect(model.baseKFactor).toBe(24);
    expect(model.movCap).toBe(20);
  });
});

describe("RatingModel behavior", () => {
  const context = {
    round: 0,
    totalRounds: 3,
    margin: 10,
    isUpset: true,
  };

  it("produces larger upset swings with a higher upset bonus", () => {
    const teamA = createTeamRating(1700);
    const teamB = createTeamRating(1500);
    const defaultModel = defaultRatingModel();
    const aggressive = createRatingModel({ upsetBonus: 0.2 });

    const [, defaultUnderdog] = updateTeamRatingsWithContext(
      teamA,
      teamB,
      70,
      80,
      context,
      defaultModel
    );
    const [, aggressiveUnderdog] = updateTeamRatingsWithContext(
      createTeamRating(1700),
      createTeamRating(1500),
      70,
      80,
      context,
      aggressive
    );

    expect(aggressiveUnderdog.rating - 1500).toBeGreaterThan(
      defaultUnderdog.rating - 1500
    );
  });

  it("treats the same margin as more decisive with a tighter movCap", () => {
    const tight = createRatingModel({ movCap: 10 });
    const loose = createRatingModel({ movCap: 30 });

    const tightScore = computeActualScores(
      78,
      70,
      { round: 0, totalRounds: 1, margin: 8, isUpset: false },
      1500,
      1500,
      tight
    );
    const looseScore = computeActualScores(
      78,
      70,
      { round: 0, totalRounds: 1, margin: 8, isUpset: false },
      1500,
      1500,
      loose
    );

    expect(tightScore[0]).toBeGreaterThan(looseScore[0]);
  });
});

describe("calibrateRatingModel", () => {
  it("ranks the 2023 Midwest champion first by rating delta", () => {
    const doc = parseSeasonFile(
      join(FIXTURES, "2023-midwest-final-four.json")
    );
    const result = calibrateRatingModel(doc);

    expect(result.fixtureId).toBe("2023-midwest-final-four");
    expect(result.championDelta).toBeGreaterThan(0);
    expect(result.championDeltaRank).toBe(1);
    expect(Math.abs(result.totalRatingChange)).toBeLessThanOrEqual(1);
  });

  it("reports higher champion delta when upset bonus increases", () => {
    const doc = parseSeasonFile(
      join(FIXTURES, "2023-midwest-final-four.json")
    );
    const baseline = calibrateRatingModel(doc);
    const boosted = calibrateRatingModel(
      doc,
      createRatingModel({ upsetBonus: 0.2 })
    );

    expect(boosted.championDelta).toBeGreaterThan(baseline.championDelta);
  });
});

describe("calibrateAllFixtures", () => {
  it("passes conservation and sanity checks across bundled seasons", () => {
    const filenames = [
      "2023-east-mini.json",
      "2023-midwest-final-four.json",
      "2023-west-mini.json",
      "2024-east-mini.json",
      "2024-south-region.json",
      "2024-title-game.json",
      "2024-west-mini.json",
    ];
    const documents = filenames.map((name) =>
      parseSeasonFile(join(FIXTURES, name))
    );

    const results = calibrateAllFixtures(defaultRatingModel(), documents);
    const summary = summarizeCalibration(results);

    expect(summary.fixtureCount).toBe(7);
    expect(summary.championsRankedFirst).toBeGreaterThanOrEqual(4);
    expect(summary.maxTotalRatingChange).toBeLessThanOrEqual(2);
    expect(summary.minEndRating).toBeGreaterThan(0);

    for (const result of results) {
      expect(Number.isFinite(result.championDelta)).toBe(true);
      expect(result.championDelta).toBeGreaterThan(0);
      expect(result.minEndRating).toBeGreaterThan(0);
    }
  });

  it("matches replaySeasonRatings champion delta for a single fixture", () => {
    const doc = parseSeasonFile(
      join(FIXTURES, "2023-midwest-final-four.json")
    );
    const { deltas } = replaySeasonRatings(doc);
    const champion = deltas.find((entry) => entry.team.name === "Purdue")!;
    const calibration = calibrateRatingModel(doc);

    expect(calibration.championDelta).toBe(champion.delta);
  });
});
