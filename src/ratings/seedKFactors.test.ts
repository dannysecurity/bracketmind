import { describe, expect, it } from "vitest";
import {
  hasSeedPair,
  seedKMultiplierForMatchup,
} from "./seedKFactors.js";
import { createRatingModel, defaultRatingModel } from "../ratingsModel.js";

describe("hasSeedPair", () => {
  it("accepts valid tournament seeds", () => {
    expect(hasSeedPair(1, 16)).toBe(true);
    expect(hasSeedPair(8, 9)).toBe(true);
  });

  it("rejects incomplete or invalid seeds", () => {
    expect(hasSeedPair(undefined, 16)).toBe(false);
    expect(hasSeedPair(1, undefined)).toBe(false);
    expect(hasSeedPair(0, 16)).toBe(false);
    expect(hasSeedPair(1, Number.NaN)).toBe(false);
  });
});

describe("seedKMultiplierForMatchup", () => {
  const model = defaultRatingModel();

  it("returns 1 when seeds are unknown", () => {
    expect(
      seedKMultiplierForMatchup(undefined, 16, { round: 0, isUpset: true }, model)
    ).toBe(1);
    expect(
      seedKMultiplierForMatchup(1, undefined, { round: 0, isUpset: true }, model)
    ).toBe(1);
  });

  it("returns 1 when seed weighting is disabled", () => {
    const disabled = createRatingModel({ seedKWeight: 0 });
    expect(
      seedKMultiplierForMatchup(16, 1, { round: 0, isUpset: true }, disabled)
    ).toBe(1);
  });

  it("boosts K more for rare seed upsets than mild ones", () => {
    const context = { round: 0, isUpset: true };
    const rare = seedKMultiplierForMatchup(16, 1, context, model);
    const mild = seedKMultiplierForMatchup(9, 8, context, model);

    expect(rare).toBeGreaterThan(1);
    expect(mild).toBeGreaterThan(1);
    expect(rare).toBeGreaterThan(mild);
  });

  it("dampens K when the favorite wins as expected", () => {
    const dampened = seedKMultiplierForMatchup(
      1,
      16,
      { round: 0, isUpset: false },
      model
    );
    const even = seedKMultiplierForMatchup(
      8,
      9,
      { round: 0, isUpset: false },
      model
    );

    expect(dampened).toBeLessThan(1);
    expect(even).toBeLessThanOrEqual(1);
    expect(dampened).toBeLessThan(even);
  });

  it("is symmetric regardless of seed argument order", () => {
    const context = { round: 0, isUpset: true };
    expect(seedKMultiplierForMatchup(16, 1, context, model)).toBe(
      seedKMultiplierForMatchup(1, 16, context, model)
    );
  });

  it("scales boost magnitude with seedKWeight", () => {
    const light = createRatingModel({ seedKWeight: 0.1 });
    const heavy = createRatingModel({ seedKWeight: 0.8 });
    const context = { round: 0, isUpset: true };

    const lightBoost = seedKMultiplierForMatchup(16, 1, context, light);
    const heavyBoost = seedKMultiplierForMatchup(16, 1, context, heavy);

    expect(heavyBoost - 1).toBeGreaterThan(lightBoost - 1);
  });
});
