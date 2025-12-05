import { describe, expect, it } from "vitest";
import { expectedMargin, simulateGame } from "./simulator.js";
import type { Team } from "./types.js";

function team(name: string, rating: number): Team {
  return { id: name.toLowerCase(), name, rating };
}

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

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
      const margin = Math.abs(result.scoreA - result.scoreB);

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
});
