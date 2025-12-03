import { describe, expect, it } from "vitest";
import { expectedScore, updateRatings } from "./ratings.js";

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
});
