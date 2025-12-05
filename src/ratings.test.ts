import { describe, expect, it } from "vitest";
import { expectedScore, upsetProbability, updateRatings } from "./ratings.js";

describe("ratings", () => {
  it("gives equal teams a 50% expected score", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
  });

  it("favors the higher-rated team", () => {
    expect(expectedScore(1600, 1400)).toBeGreaterThan(0.5);
  });

  it("transfers rating points to the winner", () => {
    const [newA, newB] = updateRatings(1500, 1500, 80, 70);
    expect(newA).toBeGreaterThan(1500);
    expect(newB).toBeLessThan(1500);
  });

  it("gives equal teams a 50% upset probability", () => {
    expect(upsetProbability(1500, 1500)).toBeCloseTo(0.5);
  });

  it("makes upsets less likely as the rating gap grows", () => {
    const narrow = upsetProbability(1600, 1500);
    const wide = upsetProbability(1800, 1500);
    expect(narrow).toBeGreaterThan(wide);
    expect(wide).toBeLessThan(0.2);
  });

  it("complements the favorite win probability", () => {
    const favorite = 1650;
    const underdog = 1420;
    expect(
      upsetProbability(favorite, underdog) +
        expectedScore(favorite, underdog)
    ).toBeCloseTo(1);
  });
});
