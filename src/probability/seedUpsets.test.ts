import { describe, expect, it } from "vitest";
import { createBracket, parseTeams } from "../bracket.js";
import {
  analyzeRoundOneUpsetOutlook,
  blendUpsetProbabilities,
  lookupHistoricalSeedUpsetRate,
} from "./seedUpsets.js";

describe("lookupHistoricalSeedUpsetRate", () => {
  it("returns canonical first-round rates for standard NCAA pairings", () => {
    expect(lookupHistoricalSeedUpsetRate(1, 16)).toEqual({
      favoriteSeed: 1,
      underdogSeed: 16,
      seedGap: 15,
      historicalRate: 0.01,
      source: "canonical-first-round",
    });
    expect(lookupHistoricalSeedUpsetRate(12, 5)).toEqual({
      favoriteSeed: 5,
      underdogSeed: 12,
      seedGap: 7,
      historicalRate: 0.35,
      source: "canonical-first-round",
    });
    expect(lookupHistoricalSeedUpsetRate(8, 9)).toMatchObject({
      historicalRate: 0.48,
      source: "canonical-first-round",
    });
  });

  it("falls back to the seed-gap model for non-canonical pairings", () => {
    const lookup = lookupHistoricalSeedUpsetRate(2, 3);

    expect(lookup.source).toBe("seed-gap-model");
    expect(lookup.seedGap).toBe(1);
    expect(lookup.historicalRate).toBe(0.48);
  });

  it("uses the long-gap floor for extreme seed mismatches", () => {
    const lookup = lookupHistoricalSeedUpsetRate(1, 20);

    expect(lookup.source).toBe("seed-gap-model");
    expect(lookup.historicalRate).toBe(0.01);
  });
});

describe("blendUpsetProbabilities", () => {
  it("returns Elo when historical weight is zero", () => {
    expect(blendUpsetProbabilities(0.4, 0.2, 0)).toBe(0.4);
  });

  it("returns historical when historical weight is one", () => {
    expect(blendUpsetProbabilities(0.4, 0.2, 1)).toBe(0.2);
  });

  it("linearly blends at the default weight", () => {
    expect(blendUpsetProbabilities(0.4, 0.2)).toBeCloseTo(0.33, 5);
  });
});

describe("analyzeRoundOneUpsetOutlook", () => {
  it("builds blended outlook for every playable round-one matchup", () => {
    const teams = parseTeams(["S1", "S2", "S3", "S4"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 100,
    }));
    const outlook = analyzeRoundOneUpsetOutlook(createBracket(teams));

    expect(outlook.matchups).toHaveLength(2);
    expect(outlook.matchups[0].seedA).toBe(1);
    expect(outlook.matchups[0].seedB).toBe(4);
    expect(outlook.matchups[0].historicalUpsetProbability).toBe(0.25);
    expect(outlook.matchups[0].historicalRateSource).toBe("seed-gap-model");
    expect(outlook.matchups[0].eloUpsetProbability).toBeGreaterThan(0);
    expect(outlook.matchups[0].blendedUpsetProbability).toBeGreaterThan(0);
    expect(outlook.expectedRoundOneUpsets).toBeGreaterThan(0);
    expect(outlook.mostLikelyUpset?.seedA).toBe(2);
    expect(outlook.mostLikelyUpset?.seedB).toBe(3);
  });

  it("uses the seed-gap model for rating-based eight-team first-round pairings", () => {
    const teams = parseTeams([
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
      "S8",
    ]).map((team, index) => ({
      ...team,
      rating: 1800 - index * 25,
    }));
    const outlook = analyzeRoundOneUpsetOutlook(createBracket(teams));
    const oneEight = outlook.matchups.find(
      (matchup) => matchup.seedA === 1 && matchup.seedB === 8
    );

    expect(outlook.matchups).toHaveLength(4);
    expect(oneEight?.historicalUpsetProbability).toBe(0.03);
    expect(oneEight?.historicalRateSource).toBe("seed-gap-model");
  });

  it("skips bye matchups and leaves probabilities null", () => {
    const teams = parseTeams(["A", "B", "C"]).map((team, index) => ({
      ...team,
      rating: 1600 - index * 100,
    }));
    const outlook = analyzeRoundOneUpsetOutlook(createBracket(teams));
    const byeMatch = outlook.matchups.find((matchup) => matchup.isByeMatch);

    expect(byeMatch).toBeTruthy();
    expect(byeMatch!.blendedUpsetProbability).toBeNull();
    expect(outlook.expectedRoundOneUpsets).toBeGreaterThan(0);
  });

  it("respects a custom historical blend weight", () => {
    const teams = parseTeams(["S1", "S2", "S3", "S4"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 100,
    }));
    const bracket = createBracket(teams);
    const defaultOutlook = analyzeRoundOneUpsetOutlook(bracket);
    const historicalOutlook = analyzeRoundOneUpsetOutlook(bracket, {
      historicalWeight: 1,
    });

    expect(historicalOutlook.matchups[0].blendedUpsetProbability).toBe(
      historicalOutlook.matchups[0].historicalUpsetProbability
    );
    expect(historicalOutlook.expectedRoundOneUpsets).toBeGreaterThan(
      defaultOutlook.expectedRoundOneUpsets
    );
  });
});
