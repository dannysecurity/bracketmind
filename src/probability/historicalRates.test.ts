import { describe, expect, it } from "vitest";
import {
  lookupHistoricalSeedUpsetRate,
  lookupHistoricalUpsetRate,
} from "./historicalRates.js";

describe("lookupHistoricalUpsetRate", () => {
  it("returns canonical first-round rates for standard NCAA pairings", () => {
    expect(lookupHistoricalUpsetRate(1, 16, 0)).toEqual({
      favoriteSeed: 1,
      underdogSeed: 16,
      seedGap: 15,
      round: 0,
      historicalRate: 0.01,
      source: "canonical-first-round",
    });
    expect(lookupHistoricalUpsetRate(12, 5, 0)).toEqual({
      favoriteSeed: 5,
      underdogSeed: 12,
      seedGap: 7,
      historicalRate: 0.35,
      source: "canonical-first-round",
      round: 0,
    });
    expect(lookupHistoricalUpsetRate(8, 9, 0)).toMatchObject({
      historicalRate: 0.48,
      source: "canonical-first-round",
    });
  });

  it("falls back to the seed-gap model for non-canonical first-round pairings", () => {
    const lookup = lookupHistoricalUpsetRate(2, 3, 0);

    expect(lookup.source).toBe("seed-gap-model");
    expect(lookup.seedGap).toBe(1);
    expect(lookup.historicalRate).toBe(0.48);
  });

  it("uses the long-gap floor for extreme seed mismatches", () => {
    const lookup = lookupHistoricalUpsetRate(1, 20, 0);

    expect(lookup.source).toBe("seed-gap-model");
    expect(lookup.historicalRate).toBe(0.01);
  });

  it("returns canonical later-round rates for common Sweet 16 pairings", () => {
    const lookup = lookupHistoricalUpsetRate(1, 4, 2);

    expect(lookup.source).toBe("canonical-round");
    expect(lookup.round).toBe(2);
    expect(lookup.historicalRate).toBe(0.22);
  });

  it("returns canonical Elite Eight rates for top-seed matchups", () => {
    const lookup = lookupHistoricalUpsetRate(1, 2, 3);

    expect(lookup.source).toBe("canonical-round");
    expect(lookup.round).toBe(3);
    expect(lookup.historicalRate).toBe(0.38);
  });

  it("applies round multipliers when no canonical later-round rate exists", () => {
    const firstRound = lookupHistoricalUpsetRate(6, 7, 0);
    const sweetSixteen = lookupHistoricalUpsetRate(6, 7, 2);

    expect(firstRound.source).toBe("seed-gap-model");
    expect(sweetSixteen.source).toBe("round-adjusted-seed-gap");
    expect(sweetSixteen.historicalRate).toBeLessThan(firstRound.historicalRate);
    expect(sweetSixteen.historicalRate).toBeCloseTo(0.48 * 0.68, 5);
  });

  it("preserves round-zero behavior through the seed alias", () => {
    expect(lookupHistoricalSeedUpsetRate(1, 16)).toEqual(
      lookupHistoricalUpsetRate(1, 16, 0)
    );
  });
});
