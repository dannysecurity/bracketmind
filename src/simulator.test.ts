import { describe, expect, it } from "vitest";
import { expectedScore } from "./ratings.js";
import { resolveWinProbabilityA } from "./probability/winProbability.js";
import {
  expectedMargin,
  simulateGame,
  simulateBestOfSeries,
  createSeededRng,
  createTournamentState,
  monteCarloGameOutcomes,
  resolveSimulationRoundContext,
  wilsonScoreInterval,
} from "./simulator.js";
import { countingRng } from "./testing/simulationFixtures.js";
import type { Team } from "./types.js";

function team(name: string, rating: number): Team {
  return { id: name.toLowerCase(), name, rating };
}

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("resolveSimulationRoundContext", () => {
  it("returns undefined when no round flags are provided", () => {
    expect(resolveSimulationRoundContext()).toBeUndefined();
  });

  it("defaults total rounds to four when only round is given", () => {
    expect(resolveSimulationRoundContext(2)).toEqual({
      round: 2,
      totalRounds: 4,
    });
  });

  it("treats the championship round when only total rounds is given", () => {
    expect(resolveSimulationRoundContext(undefined, 3)).toEqual({
      round: 2,
      totalRounds: 3,
    });
  });

  it("passes through explicit round and total rounds", () => {
    expect(resolveSimulationRoundContext(1, 5)).toEqual({
      round: 1,
      totalRounds: 5,
    });
  });
});

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
  it("consumes exactly three RNG draws per game", () => {
    const { rng, callCount } = countingRng(createSeededRng(42));
    simulateGame(team("A", 1500), team("B", 1500), { rng });
    expect(callCount()).toBe(3);
  });

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

  it("uses blended historical upset rates when seeds and weight are provided", () => {
    const underdog = team("UMBC", 1450);
    const favorite = team("Virginia", 1700);
    const options = {
      seedA: 16,
      seedB: 1,
      historicalWeight: 1,
      rng: sequenceRng([0.5, 0.5, 0.5]),
    };

    const result = simulateGame(underdog, favorite, options);
    const blendedWinProb = resolveWinProbabilityA(
      underdog,
      favorite,
      underdog.rating,
      favorite.rating,
      options
    );

    expect(result.winProbabilityA).toBeCloseTo(blendedWinProb);
    expect(result.winProbabilityA).toBeLessThan(
      expectedScore(underdog.rating, favorite.rating)
    );
  });

  it("resolves team.seed for historical upset blending without explicit seed flags", () => {
    const underdog: Team = { ...team("UMBC", 1450), seed: 16 };
    const favorite: Team = { ...team("Virginia", 1700), seed: 1 };
    const options = {
      historicalWeight: 1,
      rng: sequenceRng([0.5, 0.5, 0.5]),
    };

    const result = simulateGame(underdog, favorite, options);
    const blendedWinProb = resolveWinProbabilityA(
      underdog,
      favorite,
      underdog.rating,
      favorite.rating,
      { ...options, seedA: 16, seedB: 1 }
    );

    expect(result.winProbabilityA).toBeCloseTo(blendedWinProb);
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

  it("applies symmetric margin noise around the expected margin", () => {
    const teamA = team("A", 1500);
    const teamB = team("B", 1500);
    const baseline = expectedMargin(teamA, teamB);

    const tightest = simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0, 0.5]),
    });
    const widest = simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0.999999, 0.5]),
    });

    expect(tightest.margin).toBe(Math.max(1, baseline - 5));
    expect(widest.margin).toBe(baseline + 5);
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

  it("preserves projected margin when the loser score floor binds", () => {
    const favorite = team("Favorite", 2400);
    const underdog = team("Underdog", 800);
    const rolls = [0.01, 0.99, 0.99];
    const marginNoise = Math.floor(rolls[1] * 11) - 5;
    const projectedMargin = Math.max(
      1,
      expectedMargin(favorite, underdog) + marginNoise
    );

    const result = simulateGame(favorite, underdog, {
      rng: sequenceRng(rolls),
    });

    expect(result.winner).toBe(favorite);
    expect(result.scoreB).toBe(55);
    expect(result.margin).toBe(projectedMargin);
    expect(result.scoreA).toBe(55 + projectedMargin);
  });

  it("defaults totalRounds to four when only round is provided with tournament state", () => {
    const rolls = [0.01, 0.5, 0.5];

    const earlyA = team("EarlyA", 1500);
    const earlyB = team("EarlyB", 1500);
    const earlyState = createTournamentState([earlyA, earlyB]);
    simulateGame(earlyA, earlyB, {
      rng: sequenceRng(rolls),
      tournamentState: earlyState,
      round: 0,
      totalRounds: 4,
    });
    const earlyGain = earlyA.rating - 1500;

    const lateA = team("LateA", 1500);
    const lateB = team("LateB", 1500);
    const lateState = createTournamentState([lateA, lateB]);
    simulateGame(lateA, lateB, {
      rng: sequenceRng(rolls),
      tournamentState: lateState,
      round: 3,
    });
    const lateGain = lateA.rating - 1500;

    expect(lateGain).toBeGreaterThan(earlyGain);
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

describe("simulateBestOfSeries", () => {
  it("plays until one team reaches the majority threshold", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const rolls = [0.1, 0.5, 0.5, 0.99, 0.5, 0.5, 0.1, 0.5, 0.5];
    const series = simulateBestOfSeries(teamA, teamB, 3, {
      rng: sequenceRng(rolls),
    });

    expect(series.bestOf).toBe(3);
    expect(series.games).toHaveLength(3);
    expect(series.winsA + series.winsB).toBe(3);
    expect(Math.max(series.winsA, series.winsB)).toBe(2);
    expect(series.winner.id).toBe(teamA.id);
  });

  it("carries dynamic ratings forward across games", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const state = createTournamentState([teamA, teamB]);
    const rolls = [0.1, 0.5, 0.5, 0.99, 0.5, 0.5, 0.1, 0.5, 0.5];

    const series = simulateBestOfSeries(teamA, teamB, 3, {
      rng: sequenceRng(rolls),
      tournamentState: state,
    });

    expect(series.teamA.rating).not.toBe(1500);
    expect(series.teamB.rating).not.toBe(1500);
    expect(series.teamA.rating + series.teamB.rating).toBe(3000);
  });

  it("recomputes win probability from updated ratings between series games", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const state = createTournamentState([teamA, teamB]);
    const rolls = [0.1, 0.5, 0.5, 0.99, 0.5, 0.5, 0.1, 0.5, 0.5];

    const series = simulateBestOfSeries(teamA, teamB, 3, {
      rng: sequenceRng(rolls),
      tournamentState: state,
    });

    expect(series.games).toHaveLength(3);
    expect(series.games[0].winProbabilityA).toBeCloseTo(0.64, 2);
    expect(series.games[1].winProbabilityA).not.toBe(series.games[0].winProbabilityA);
    expect(series.games[2].winProbabilityA).not.toBe(series.games[1].winProbabilityA);
  });

  it("is deterministic with a fixed seed", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const first = simulateBestOfSeries(teamA, teamB, 5, {
      rng: createSeededRng(42),
    });
    const second = simulateBestOfSeries(teamA, teamB, 5, {
      rng: createSeededRng(42),
    });

    expect(first).toEqual(second);
  });

  it("rejects even best-of lengths", () => {
    expect(() =>
      simulateBestOfSeries(team("A", 1500), team("B", 1500), 4)
    ).toThrow(/odd/);
  });

  it("rejects non-positive best-of lengths", () => {
    expect(() =>
      simulateBestOfSeries(team("A", 1500), team("B", 1500), 0)
    ).toThrow(/positive odd integer/);
  });

  it("rejects non-integer best-of lengths", () => {
    expect(() =>
      simulateBestOfSeries(team("A", 1500), team("B", 1500), 3.5)
    ).toThrow(/positive odd integer/);
  });

  it("plays a single game for best-of-one", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const series = simulateBestOfSeries(teamA, teamB, 1, {
      rng: sequenceRng([0.1, 0.5, 0.5]),
    });

    expect(series.games).toHaveLength(1);
    expect(series.winsA).toBe(1);
    expect(series.winsB).toBe(0);
    expect(series.winner.id).toBe(teamA.id);
    expect(series.games[0].winner.id).toBe(teamA.id);
  });

  it("ends early when a team sweeps a best-of-three", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const { rng, callCount } = countingRng(
      sequenceRng([0.1, 0.5, 0.5, 0.1, 0.5, 0.5])
    );

    const series = simulateBestOfSeries(teamA, teamB, 3, { rng });

    expect(series.games).toHaveLength(2);
    expect(series.winsA).toBe(2);
    expect(series.winsB).toBe(0);
    expect(series.winner.id).toBe(teamA.id);
    expect(callCount()).toBe(6);
  });

  it("does not mutate the input team objects", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const originalA = { ...teamA };
    const originalB = { ...teamB };

    simulateBestOfSeries(teamA, teamB, 3, {
      rng: sequenceRng([0.1, 0.5, 0.5, 0.99, 0.5, 0.5, 0.1, 0.5, 0.5]),
    });

    expect(teamA).toEqual(originalA);
    expect(teamB).toEqual(originalB);
  });
});

describe("wilsonScoreInterval", () => {
  it("returns a symmetric interval around the observed rate", () => {
    const interval = wilsonScoreInterval(712, 1000);
    expect(interval.low).toBeLessThan(0.712);
    expect(interval.high).toBeGreaterThan(0.712);
    expect(interval.low + interval.high).toBeCloseTo(1.424, 2);
  });

  it("narrows as trial count increases", () => {
    const small = wilsonScoreInterval(7, 10);
    const large = wilsonScoreInterval(700, 1000);
    expect(large.high - large.low).toBeLessThan(small.high - small.low);
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
    expect(result.winRateConfidenceA.low).toBeLessThanOrEqual(result.winRateA);
    expect(result.winRateConfidenceA.high).toBeGreaterThanOrEqual(result.winRateA);
    expect(result.winRateConfidenceB.low).toBeLessThanOrEqual(result.winRateB);
    expect(result.winRateConfidenceB.high).toBeGreaterThanOrEqual(result.winRateB);
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
