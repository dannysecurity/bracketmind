import { describe, expect, it } from "vitest";
import {
  createBracket,
  getChampion,
  parseTeams,
  simulateBracket,
} from "../bracket.js";
import { monteCarloChampionshipRates } from "../simulator.js";
import {
  analyzeUpsetLandscape,
  mostLikelyUpsetCandidate,
} from "./analytics.js";
import {
  computeChampionshipProbabilities,
  computeSubtreeDistribution,
} from "./bracketPaths.js";

describe("bracketPaths", () => {
  it("awards a two-team field to the favorite", () => {
    const teams = parseTeams(["Alpha:1600", "Beta:1500"]);
    const bracket = createBracket(teams);
    const probs = computeChampionshipProbabilities(bracket);

    expect(probs.get(teams[0].id)).toBeGreaterThan(0.5);
    expect(probs.get(teams[1].id)).toBeLessThan(0.5);
    expect(
      (probs.get(teams[0].id) ?? 0) + (probs.get(teams[1].id) ?? 0)
    ).toBeCloseTo(1, 5);
  });

  it("sums championship probabilities to one for a four-team bracket", () => {
    const teams = parseTeams(["S1:1700", "S2:1600", "S3:1550", "S4:1500"]);
    const bracket = createBracket(teams);
    const probs = computeChampionshipProbabilities(bracket);
    const total = teams.reduce(
      (sum, team) => sum + (probs.get(team.id) ?? 0),
      0
    );

    expect(total).toBeCloseTo(1, 5);
    expect(probs.get(teams[0].id)).toBeGreaterThan(probs.get(teams[3].id)!);
  });

  it("tracks bye advancement in subtree distributions", () => {
    const teams = parseTeams(["A:1700", "B:1600", "C:1500"]);
    const bracket = createBracket(teams);
    const dist = computeSubtreeDistribution(bracket, 0, 0);

    expect(dist.get(teams[0].id)).toBe(1);
    expect([...dist.values()].reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      1,
      5
    );
  });

  it("aligns roughly with Monte Carlo championship rates", () => {
    const teams = parseTeams(["S1:1700", "S2:1600", "S3:1550", "S4:1500"]);
    const bracket = createBracket(teams);
    const analytical = computeChampionshipProbabilities(bracket);
    const simulated = monteCarloChampionshipRates(teams, 4000, (field) =>
      getChampion(simulateBracket(createBracket(field)))
    );

    for (const team of teams) {
      const simRate = simulated.get(team.id) ?? 0;
      const anaRate = analytical.get(team.id) ?? 0;
      expect(simRate).toBeGreaterThan(anaRate - 0.12);
      expect(simRate).toBeLessThan(anaRate + 0.12);
    }
  });
});

describe("analyzeUpsetLandscape", () => {
  it("identifies the closest first-round matchup as the top upset", () => {
    const teams = parseTeams(["S1:1700", "S2:1600", "S3:1550", "S4:1500"]);
    const landscape = analyzeUpsetLandscape(teams);
    const roundOne = landscape.roundSummaries[0];

    expect(roundOne.mostLikelyUpset?.seedA).toBe(2);
    expect(roundOne.mostLikelyUpset?.seedB).toBe(3);
    expect(landscape.mostLikelyUpsetOverall?.round).toBe(0);
  });

  it("includes later-round expected upset pairings", () => {
    const teams = parseTeams(["S1:1700", "S2:1600", "S3:1550", "S4:1500"]);
    const landscape = analyzeUpsetLandscape(teams);
    const semifinals = landscape.roundSummaries[0];
    const finalRound = landscape.roundSummaries[1];

    expect(semifinals.roundLabel).toBe("Semifinals");
    expect(semifinals.candidates.every((candidate) => candidate.isKnownMatchup)).toBe(
      true
    );
    expect(finalRound.roundLabel).toBe("Final");
    expect(finalRound.candidates.length).toBeGreaterThan(0);
    expect(finalRound.candidates[0].isKnownMatchup).toBe(false);
    expect(finalRound.candidates[0].meetingProbability).toBeLessThan(1);
  });

  it("picks the highest upset expectation via helper", () => {
    const teams = parseTeams(["S1:1700", "S2:1600", "S3:1550", "S4:1500"]);
    const { roundSummaries } = analyzeUpsetLandscape(teams);
    const best = mostLikelyUpsetCandidate(roundSummaries[0].candidates);

    expect(best?.seedA).toBe(2);
    expect(best?.seedB).toBe(3);
  });
});
