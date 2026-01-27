import { describe, expect, it } from "vitest";
import { createBracket, parseTeams } from "./bracket.js";
import {
  analyzeSeeding,
  buildSeededTeams,
  getRoundOneMatchups,
  mostLikelyUpset,
} from "./seeding.js";

describe("seeding", () => {
  it("ranks teams by rating into seeds", () => {
    const teams = parseTeams(["Low", "High", "Mid"]).map((team, i) => ({
      ...team,
      rating: [1500, 1700, 1600][i],
    }));

    expect(buildSeededTeams(teams)).toEqual([
      { seed: 1, team: teams[1] },
      { seed: 2, team: teams[2] },
      { seed: 3, team: teams[0] },
    ]);
  });

  it("returns round-one pairings with blended upset probabilities", () => {
    const teams = parseTeams(["S1", "S2", "S3", "S4"]).map((team, i) => ({
      ...team,
      rating: 1700 - i * 100,
    }));
    const matchups = getRoundOneMatchups(createBracket(teams));

    expect(matchups).toHaveLength(2);
    expect(matchups[0].seedA).toBe(1);
    expect(matchups[0].seedB).toBe(4);
    expect(matchups[1].seedA).toBe(2);
    expect(matchups[1].seedB).toBe(3);
    expect(matchups[0].upsetProbability).toBeGreaterThan(0);
    expect(matchups[0].upsetProbability!).toBeLessThan(0.5);
    expect(matchups[0].eloUpsetProbability).toBeGreaterThan(0);
    expect(matchups[0].historicalUpsetProbability).toBe(0.25);
    expect(matchups[1].upsetProbability!).toBeGreaterThan(
      matchups[0].upsetProbability!
    );
  });

  it("marks bye matchups and skips upset probability", () => {
    const teams = parseTeams(["A", "B", "C"]).map((team, i) => ({
      ...team,
      rating: 1600 - i * 100,
    }));
    const matchups = getRoundOneMatchups(createBracket(teams));
    const byeMatch = matchups.find((matchup) => matchup.isByeMatch);

    expect(byeMatch).toBeTruthy();
    expect(byeMatch!.upsetProbability).toBeNull();
  });

  it("picks the closest matchup as the most likely upset", () => {
    const teams = parseTeams(["S1", "S2", "S3", "S4"]).map((team, i) => ({
      ...team,
      rating: 1700 - i * 100,
    }));
    const { roundOneMatchups, upsetOutlook } = analyzeSeeding(teams);
    const upset = mostLikelyUpset(roundOneMatchups);

    expect(upset?.seedA).toBe(2);
    expect(upset?.seedB).toBe(3);
    expect(upsetOutlook.expectedRoundOneUpsets).toBeGreaterThan(0);
    expect(upsetOutlook.mostLikelyUpset?.seedA).toBe(2);
    expect(upsetOutlook.mostLikelyUpset?.seedB).toBe(3);
  });
});
