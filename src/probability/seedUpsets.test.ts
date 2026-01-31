import { describe, expect, it } from "vitest";
import { createBracket, parseTeams } from "../bracket.js";
import {
  analyzeRoundOneUpsetOutlook,
  blendUpsetProbabilities,
  forecastMatchupUpset,
} from "./seedUpsets.js";
import { lookupHistoricalSeedUpsetRate } from "./historicalRates.js";

describe("lookupHistoricalSeedUpsetRate", () => {
  it("returns canonical first-round rates for standard NCAA pairings", () => {
    expect(lookupHistoricalSeedUpsetRate(1, 16)).toEqual({
      favoriteSeed: 1,
      underdogSeed: 16,
      seedGap: 15,
      round: 0,
      historicalRate: 0.01,
      source: "canonical-first-round",
    });
    expect(lookupHistoricalSeedUpsetRate(12, 5)).toEqual({
      favoriteSeed: 5,
      underdogSeed: 12,
      seedGap: 7,
      round: 0,
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

  it("clamps historical weight to the 0–1 range", () => {
    expect(blendUpsetProbabilities(0.4, 0.2, -0.5)).toBe(0.4);
    expect(blendUpsetProbabilities(0.4, 0.2, 1.5)).toBe(0.2);
  });
});

describe("forecastMatchupUpset", () => {
  it("returns Elo-only forecast when seeds are missing", () => {
    const teams = parseTeams(["Alpha:1600", "Beta:1500"]);
    const forecast = forecastMatchupUpset(teams[0], teams[1], null, null);

    expect(forecast.historicalUpsetProbability).toBeNull();
    expect(forecast.upsetProbability).toBe(forecast.eloUpsetProbability);
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

  it("uses canonical NCAA first-round rates for a 16-team rating-seeded bracket", () => {
    const teams = parseTeams(
      Array.from({ length: 16 }, (_, index) => `S${index + 1}`)
    ).map((team, index) => ({
      ...team,
      rating: 2000 - index * 10,
    }));
    const outlook = analyzeRoundOneUpsetOutlook(createBracket(teams));
    const oneSixteen = outlook.matchups.find(
      (matchup) => matchup.seedA === 1 && matchup.seedB === 16
    );
    const fiveTwelve = outlook.matchups.find(
      (matchup) => matchup.seedA === 5 && matchup.seedB === 12
    );
    const eightNine = outlook.matchups.find(
      (matchup) => matchup.seedA === 8 && matchup.seedB === 9
    );

    expect(outlook.matchups).toHaveLength(8);
    expect(oneSixteen?.historicalUpsetProbability).toBe(0.01);
    expect(oneSixteen?.historicalRateSource).toBe("canonical-first-round");
    expect(fiveTwelve?.historicalUpsetProbability).toBe(0.35);
    expect(fiveTwelve?.historicalRateSource).toBe("canonical-first-round");
    expect(fiveTwelve?.favoriteSeed).toBe(5);
    expect(fiveTwelve?.underdogSeed).toBe(12);
    expect(eightNine?.historicalUpsetProbability).toBe(0.48);
    expect(eightNine?.historicalRateSource).toBe("canonical-first-round");
    expect(outlook.mostLikelyUpset?.seedA).toBe(8);
    expect(outlook.mostLikelyUpset?.seedB).toBe(9);
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
