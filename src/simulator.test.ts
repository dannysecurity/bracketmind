import { describe, expect, it } from "vitest";
import {
  expectedMargin,
  simulateGame,
  createSeededRng,
  createTournamentState,
  monteCarloGameOutcomes,
} from "./simulator.js";
import type { Team } from "./types.js";

function team(name: string, rating: number): Team {
  return { id: name.toLowerCase(), name, rating };
}

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("createSeededRng", () => {
  it("produces repeatable sequences for the same seed", () => {
    const first = createSeededRng(42);
    const second = createSeededRng(42);
    const valuesA = Array.from({ length: 5 }, () => first());
    const valuesB = Array.from({ length: 5 }, () => second());
    expect(valuesA).toEqual(valuesB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createSeededRng(1)();
    const b = createSeededRng(2)();
    expect(a).not.toBe(b);
  });
});

describe("expectedMargin", () => {
  it("gives even matchups a modest baseline margin", () => {
    expect(expectedMargin(team("A", 1500), team("B", 1500))).toBe(5);
  });

  it("projects wider margins for strong favorites", () => {
    const even = expectedMargin(team("A", 1500), team("B", 1500));
    const favorite = expectedMargin(team("A", 1700), team("B", 1500));
    expect(favorite).toBeGreaterThan(even);
  });

  it("projects tighter margins when the underdog wins", () => {
    const favoriteWin = expectedMargin(team("A", 1700), team("B", 1500));
    const upsetWin = expectedMargin(team("B", 1500), team("A", 1700));
    expect(upsetWin).toBeLessThan(favoriteWin);
  });
});

describe("simulateGame", () => {
  it("picks the higher-rated team when the outcome roll favors them", () => {
    const duke = team("Duke", 1650);
    const kansas = team("Kansas", 1500);

    const result = simulateGame(duke, kansas, {
      rng: sequenceRng([0.1, 0.5, 0.5]),
    });

    expect(result.winner).toBe(duke);
    expect(result.scoreA).toBeGreaterThan(result.scoreB);
    expect(result.winProbabilityA).toBeGreaterThan(0.5);
  });

  it("awards an upset when the outcome roll exceeds the favorite probability", () => {
    const duke = team("Duke", 1650);
    const kansas = team("Kansas", 1500);

    const result = simulateGame(duke, kansas, {
      rng: sequenceRng([0.99, 0.5, 0.5]),
    });

    expect(result.winner).toBe(kansas);
    expect(result.scoreB).toBeGreaterThan(result.scoreA);
  });

  it("always gives the winner the higher score", () => {
    const a = team("A", 1600);
    const b = team("B", 1400);

    for (let i = 0; i < 200; i++) {
      const result = simulateGame(a, b);
      const winnerScore =
        result.winner.id === a.id ? result.scoreA : result.scoreB;
      const loserScore =
        result.winner.id === a.id ? result.scoreB : result.scoreA;
      expect(winnerScore).toBeGreaterThanOrEqual(loserScore);
    }
  });

  it("tracks Elo win probability over many trials", () => {
    const favorite = team("Favorite", 1600);
    const underdog = team("Underdog", 1400);
    const trials = 4000;
    let favoriteWins = 0;

    for (let i = 0; i < trials; i++) {
      const result = simulateGame(favorite, underdog);
      if (result.winner.id === favorite.id) {
        favoriteWins++;
      }
    }

    const observed = favoriteWins / trials;
    expect(observed).toBeGreaterThan(0.55);
    expect(observed).toBeLessThan(0.85);
  });

  it("yields larger margins when the stronger team wins", () => {
    const favorite = team("Favorite", 1750);
    const underdog = team("Underdog", 1500);
    const trials = 500;
    let favoriteMarginTotal = 0;
    let upsetMarginTotal = 0;
    let favoriteWins = 0;
    let upsetWins = 0;

    for (let i = 0; i < trials; i++) {
      const result = simulateGame(favorite, underdog);
      const margin = result.margin;

      if (result.winner.id === favorite.id) {
        favoriteMarginTotal += margin;
        favoriteWins++;
      } else {
        upsetMarginTotal += margin;
        upsetWins++;
      }
    }

    expect(favoriteWins).toBeGreaterThan(0);
    expect(upsetWins).toBeGreaterThan(0);
    expect(favoriteMarginTotal / favoriteWins).toBeGreaterThan(
      upsetMarginTotal / upsetWins
    );
  });

  it("reports margin and upset metadata on each result", () => {
    const favorite = team("Favorite", 1700);
    const underdog = team("Underdog", 1500);

    const expectedWin = simulateGame(favorite, underdog, {
      rng: sequenceRng([0.1, 0.5, 0.5]),
    });
    expect(expectedWin.margin).toBe(expectedWin.scoreA - expectedWin.scoreB);
    expect(expectedWin.isUpset).toBe(false);

    const upset = simulateGame(favorite, underdog, {
      rng: sequenceRng([0.99, 0.5, 0.5]),
    });
    expect(upset.isUpset).toBe(true);
    expect(upset.margin).toBeGreaterThan(0);
  });

  it("updates tournament ratings when state is provided", () => {
    const teamA = team("TeamA", 1500);
    const teamB = team("TeamB", 1500);
    const state = createTournamentState([teamA, teamB]);

    const result = simulateGame(teamA, teamB, {
      rng: sequenceRng([0.1, 0.5, 0.5]),
      tournamentState: state,
    });

    expect(result.ratingDeltaA).toBeGreaterThan(0);
    expect(result.ratingDeltaB).toBeLessThan(0);
    expect(teamA.rating).toBeGreaterThan(1500);
    expect(teamB.rating).toBeLessThan(1500);
  });
});

describe("monteCarloGameOutcomes", () => {
  it("returns win rates that sum to one", () => {
    const duke = team("Duke", 1650);
    const kansas = team("Kansas", 1500);
    const result = monteCarloGameOutcomes(duke, kansas, 500, {
      rng: createSeededRng(99),
    });

    expect(result.winRateA + result.winRateB).toBeCloseTo(1, 10);
    expect(result.iterations).toBe(500);
    expect(result.sampleResult.winner).toBeDefined();
    expect(result.marginStdDev).toBeGreaterThanOrEqual(0);
    expect(result.marginPercentiles.p10).toBeLessThanOrEqual(
      result.marginPercentiles.p50
    );
    expect(result.marginPercentiles.p50).toBeLessThanOrEqual(
      result.marginPercentiles.p90
    );
  });

  it("favors the higher-rated team over many trials", () => {
    const favorite = team("Favorite", 1700);
    const underdog = team("Underdog", 1400);
    const result = monteCarloGameOutcomes(favorite, underdog, 3000);

    expect(result.winRateA).toBeGreaterThan(result.winRateB);
    expect(result.analyticalWinRateA).toBeGreaterThan(0.5);
  });

  it("is deterministic with a fixed seed", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const first = monteCarloGameOutcomes(teamA, teamB, 100, {
      rng: createSeededRng(42),
    });
    const second = monteCarloGameOutcomes(teamA, teamB, 100, {
      rng: createSeededRng(42),
    });

    expect(first).toEqual(second);
  });

  it("reports zero margin spread for a single iteration", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);

    const result = monteCarloGameOutcomes(teamA, teamB, 1, {
      rng: createSeededRng(77),
    });

    expect(result.marginStdDev).toBe(0);
    expect(result.marginPercentiles.p10).toBe(result.sampleResult.margin);
    expect(result.marginPercentiles.p50).toBe(result.sampleResult.margin);
    expect(result.marginPercentiles.p90).toBe(result.sampleResult.margin);
  });

  it("throws when zero trials are requested", () => {
    expect(() =>
      monteCarloGameOutcomes(team("A", 1500), team("B", 1500), 0)
    ).toThrow(/At least one iteration/);
  });
});
