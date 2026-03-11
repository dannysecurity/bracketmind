import { describe, expect, it } from "vitest";
import { expectedScore } from "../ratings.js";
import {
  forecastMatchupUpset,
  DEFAULT_HISTORICAL_WEIGHT,
} from "./seedUpsets.js";
import {
  isUnderdogTeamA,
  resolveWinProbabilityA,
} from "./winProbability.js";
import type { Team } from "../types.js";

function team(name: string, rating: number): Team {
  return { id: name.toLowerCase(), name, rating };
}

describe("isUnderdogTeamA", () => {
  it("identifies the lower-rated team as the underdog", () => {
    expect(isUnderdogTeamA(1500, 1600, 5, 1)).toBe(true);
    expect(isUnderdogTeamA(1600, 1500, 1, 5)).toBe(false);
  });

  it("uses the worse tournament seed when ratings are equal", () => {
    expect(isUnderdogTeamA(1500, 1500, 16, 1)).toBe(true);
    expect(isUnderdogTeamA(1500, 1500, 1, 16)).toBe(false);
  });
});

describe("resolveWinProbabilityA", () => {
  it("returns pure Elo when seeds are omitted", () => {
    const teamA = team("Underdog", 1500);
    const teamB = team("Favorite", 1600);

    expect(
      resolveWinProbabilityA(teamA, teamB, teamA.rating, teamB.rating, {})
    ).toBeCloseTo(expectedScore(1500, 1600));
  });

  it("returns pure Elo when historical weight is zero", () => {
    const teamA = team("Underdog", 1500);
    const teamB = team("Favorite", 1600);

    expect(
      resolveWinProbabilityA(teamA, teamB, teamA.rating, teamB.rating, {
        seedA: 16,
        seedB: 1,
        historicalWeight: 0,
      })
    ).toBeCloseTo(expectedScore(1500, 1600));
  });

  it("blends historical seed upset rates when seeds and weight are provided", () => {
    const teamA = team("Underdog", 1500);
    const teamB = team("Favorite", 1600);
    const forecast = forecastMatchupUpset(teamA, teamB, 16, 1, 1, 0);

    expect(
      resolveWinProbabilityA(teamA, teamB, teamA.rating, teamB.rating, {
        seedA: 16,
        seedB: 1,
        historicalWeight: 1,
      })
    ).toBeCloseTo(forecast.upsetProbability!);
  });

  it("assigns the favorite the complement of the blended upset probability", () => {
    const teamA = team("Favorite", 1600);
    const teamB = team("Underdog", 1500);
    const forecast = forecastMatchupUpset(teamA, teamB, 1, 16, 1, 0);

    expect(
      resolveWinProbabilityA(teamA, teamB, teamA.rating, teamB.rating, {
        seedA: 1,
        seedB: 16,
        historicalWeight: 1,
      })
    ).toBeCloseTo(1 - forecast.upsetProbability!);
  });

  it("uses the default historical blend weight from forecastMatchupUpset", () => {
    const teamA = team("Underdog", 1500);
    const teamB = team("Favorite", 1600);
    const forecast = forecastMatchupUpset(
      teamA,
      teamB,
      16,
      1,
      DEFAULT_HISTORICAL_WEIGHT,
      0
    );

    expect(
      resolveWinProbabilityA(teamA, teamB, teamA.rating, teamB.rating, {
        seedA: 16,
        seedB: 1,
        historicalWeight: DEFAULT_HISTORICAL_WEIGHT,
      })
    ).toBeCloseTo(forecast.upsetProbability!);
  });
});
