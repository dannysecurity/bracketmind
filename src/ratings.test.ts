import { describe, expect, it } from "vitest";
import {
  createTeamRating,
  expectedMarginFromRatings,
  expectedScore,
  isRatingUpset,
  kFactorForTeam,
  upsetProbability,
  updateRatings,
  updateTeamRatings,
} from "./ratings.js";

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

  it("applies independent K factors to each team", () => {
    const [newProvisional, newEstablished] = updateRatings(
      1500,
      1500,
      90,
      60,
      kFactorForTeam(0),
      kFactorForTeam(40)
    );

    expect(newProvisional - 1500).toBeGreaterThan(1500 - newEstablished);
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

  it("flags underdog wins as upsets and ignores ties", () => {
    expect(isRatingUpset(1700, 1500, false)).toBe(true);
    expect(isRatingUpset(1700, 1500, true)).toBe(false);
    expect(isRatingUpset(1500, 1500, true)).toBe(false);
    expect(isRatingUpset(1700, 1500, false, true)).toBe(false);
  });

  it("uses a higher K factor for provisional teams", () => {
    expect(kFactorForTeam(0)).toBeGreaterThan(kFactorForTeam(15));
    expect(kFactorForTeam(15)).toBeGreaterThan(kFactorForTeam(40));
  });

  it("tracks games played and applies team-specific K factors", () => {
    const provisional = createTeamRating(1500);
    const established = createTeamRating(1500, { gamesPlayed: 40 });

    const [newProvisional, newEstablished] = updateTeamRatings(
      provisional,
      established,
      80,
      70
    );

    expect(newProvisional.gamesPlayed).toBe(1);
    expect(newEstablished.gamesPlayed).toBe(41);
    expect(newProvisional.lastDelta).toBeGreaterThan(newEstablished.lastDelta);
  });

  it("projects wider margins for strong favorites than for upsets", () => {
    const even = expectedMarginFromRatings(1500, 1500);
    const favorite = expectedMarginFromRatings(1700, 1500);
    const upset = expectedMarginFromRatings(1500, 1700);
    expect(even).toBe(5);
    expect(favorite).toBeGreaterThan(even);
    expect(upset).toBeLessThan(favorite);
  });
});
