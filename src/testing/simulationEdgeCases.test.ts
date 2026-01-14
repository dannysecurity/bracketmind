import { describe, expect, it } from "vitest";
import {
  createBracket,
  getChampion,
  parseTeams,
  simulateBracket,
} from "../bracket.js";
import { expectedScore } from "../ratings.js";
import {
  createSeededRng,
  expectedMargin,
  monteCarloChampionshipRates,
  monteCarloGameOutcomes,
  simulateGame,
} from "../simulator.js";
import {
  createTournamentState,
  effectiveRating,
  recordGameResult,
} from "../tournamentState.js";
import {
  assertBracketSimulationInvariants,
  assertWinnerHasHigherScore,
  byeMatches,
  computeGameOutcomeAggregates,
  constantRng,
  expectedByeCount,
  finalMatch,
  matchesInRound,
  playedMatchesForTeam,
  ratedField,
  roundOneMatches,
  sequenceRng,
  team,
  winProbabilityFor,
} from "./simulationFixtures.js";

describe("simulateGame edge cases", () => {
  it("awards the win to team A when the roll is zero and team A is favored", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const probabilityA = winProbabilityFor(teamA.rating, teamB.rating);

    expect(probabilityA).toBeGreaterThan(0);

    const result = simulateGame(teamA, teamB, {
      rng: constantRng(0),
    });

    expect(result.winner).toBe(teamA);
    expect(result.winProbabilityA).toBeCloseTo(probabilityA, 5);
  });

  it("awards the win to team B when the roll equals team A's win probability", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const probabilityA = winProbabilityFor(teamA.rating, teamB.rating);

    const result = simulateGame(teamA, teamB, {
      rng: constantRng(probabilityA),
    });

    expect(result.winner).toBe(teamB);
    expect(result.winProbabilityA).toBeCloseTo(probabilityA, 5);
  });

  it("treats equal ratings as a coin flip with no upset flag", () => {
    const teamA = team("EvenA", 1500);
    const teamB = team("EvenB", 1500);

    expect(expectedScore(1500, 1500)).toBe(0.5);

    const aWins = simulateGame(teamA, teamB, { rng: constantRng(0.49) });
    expect(aWins.winner).toBe(teamA);
    expect(aWins.isUpset).toBe(false);

    const bWins = simulateGame(teamA, teamB, { rng: constantRng(0.51) });
    expect(bWins.winner).toBe(teamB);
    expect(bWins.isUpset).toBe(false);

    const tieBreak = simulateGame(teamA, teamB, { rng: constantRng(0.5) });
    expect(tieBreak.winner).toBe(teamB);
    expect(tieBreak.isUpset).toBe(false);
  });

  it("never flags a favorite win as an upset at extreme rating gaps", () => {
    const favorite = team("Favorite", 2400);
    const longshot = team("Longshot", 800);

    const result = simulateGame(favorite, longshot, {
      rng: sequenceRng([0, 0.5, 0.5]),
    });

    expect(result.winner).toBe(favorite);
    expect(result.isUpset).toBe(false);
    expect(result.winProbabilityA).toBeGreaterThan(0.99);
  });

  it("flags a longshot win as an upset when the outcome roll favors them", () => {
    const favorite = team("Favorite", 2400);
    const longshot = team("Longshot", 800);
    const probabilityA = winProbabilityFor(favorite.rating, longshot.rating);

    const result = simulateGame(favorite, longshot, {
      rng: sequenceRng([probabilityA, 0.5, 0.5]),
    });

    expect(result.winner).toBe(longshot);
    expect(result.isUpset).toBe(true);
  });

  it("keeps generated scores within the expected floor and baseline ranges", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);

    const result = simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0, 0]),
    });

    expect(result.scoreA).toBeGreaterThanOrEqual(68);
    expect(result.scoreB).toBeGreaterThanOrEqual(55);
    assertWinnerHasHigherScore(result, teamA);
  });

  it("clamps loser scores at 55 when the projected margin is very large", () => {
    const favorite = team("Favorite", 2100);
    const underdog = team("Underdog", 1100);

    const result = simulateGame(favorite, underdog, {
      rng: sequenceRng([0.01, 0.99, 0.99]),
    });

    expect(result.winner).toBe(favorite);
    const loserScore =
      result.winner.id === favorite.id ? result.scoreB : result.scoreA;
    expect(loserScore).toBeGreaterThanOrEqual(55);
    assertWinnerHasHigherScore(result, favorite);
  });

  it("caps the winner score using the margin-derived ceiling", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const rolls = [0.01, 0.99, 0.99];

    const result = simulateGame(teamA, teamB, {
      rng: sequenceRng(rolls),
    });

    const baseMargin = Math.max(
      1,
      expectedMargin(teamA, teamB) + Math.floor(rolls[1] * 10 - 5)
    );
    const maxWinnerScore =
      68 + Math.floor(rolls[2] * 12) + Math.floor(baseMargin / 2);
    const winnerScore =
      result.winner.id === teamA.id ? result.scoreA : result.scoreB;

    expect(winnerScore).toBeLessThanOrEqual(maxWinnerScore);
    assertWinnerHasHigherScore(result, teamA);
  });

  it("leaves rating deltas undefined when no tournament state is provided", () => {
    const result = simulateGame(team("A", 1500), team("B", 1400), {
      rng: sequenceRng([0.1, 0.5, 0.5]),
    });

    expect(result.ratingDeltaA).toBeUndefined();
    expect(result.ratingDeltaB).toBeUndefined();
  });

  it("enforces a minimum expected margin of one point for extreme rating gaps", () => {
    const heavyFavorite = team("Goliath", 2400);
    const longshot = team("David", 800);

    const margin = simulateGame(heavyFavorite, longshot, {
      rng: sequenceRng([0.01, 0, 0]),
    }).margin;

    expect(margin).toBeGreaterThanOrEqual(1);
  });

  it("applies larger rating deltas in later rounds via simulateGame", () => {
    const earlyA = team("EarlyA", 1500);
    const earlyB = team("EarlyB", 1500);
    const earlyState = createTournamentState([earlyA, earlyB]);
    simulateGame(earlyA, earlyB, {
      rng: sequenceRng([0.01, 0.5, 0.5]),
      tournamentState: earlyState,
      round: 0,
      totalRounds: 3,
    });
    const earlyGain = earlyA.rating - 1500;

    const lateA = team("LateA", 1500);
    const lateB = team("LateB", 1500);
    const lateState = createTournamentState([lateA, lateB]);
    simulateGame(lateA, lateB, {
      rng: sequenceRng([0.01, 0.5, 0.5]),
      tournamentState: lateState,
      round: 2,
      totalRounds: 3,
    });
    const lateGain = lateA.rating - 1500;

    expect(lateGain).toBeGreaterThan(earlyGain);
  });

  it("uses seed ratings for opponents missing from tournament state", () => {
    const tracked = team("Tracked", 1600);
    const untracked = team("Untracked", 1200);
    const state = createTournamentState([tracked]);
    const expectedProb = winProbabilityFor(1600, 1200);

    const result = simulateGame(tracked, untracked, {
      rng: constantRng(0.01),
      tournamentState: state,
    });

    expect(result.winProbabilityA).toBeCloseTo(expectedProb, 5);
    expect(effectiveRating(untracked, state)).toBe(1200);
    expect(result.ratingDeltaA).toBe(0);
    expect(result.ratingDeltaB).toBe(0);
  });

  it("returns zero deltas when neither team is tracked in tournament state", () => {
    const tracked = team("Tracked", 1600);
    const ghostA = team("GhostA", 1500);
    const ghostB = team("GhostB", 1400);
    const state = createTournamentState([tracked]);

    const result = simulateGame(ghostA, ghostB, {
      rng: constantRng(0.01),
      tournamentState: state,
    });

    expect(result.ratingDeltaA).toBe(0);
    expect(result.ratingDeltaB).toBe(0);
    expect(ghostA.rating).toBe(1500);
    expect(ghostB.rating).toBe(1400);
  });

  it("awards the win to team B when the roll is one and team A is favored", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const probabilityA = winProbabilityFor(teamA.rating, teamB.rating);

    expect(probabilityA).toBeLessThan(1);

    const result = simulateGame(teamA, teamB, {
      rng: constantRng(1),
    });

    expect(result.winner).toBe(teamB);
    expect(result.winProbabilityA).toBeCloseTo(probabilityA, 5);
  });

  it("returns zero deltas when a tracked team loses to an untracked opponent", () => {
    const tracked = team("Tracked", 1200);
    const untracked = team("Untracked", 1600);
    const state = createTournamentState([tracked]);

    const result = simulateGame(tracked, untracked, {
      rng: sequenceRng([0.99, 0.5, 0.5]),
      tournamentState: state,
    });

    expect(result.winner).toBe(untracked);
    expect(result.ratingDeltaA).toBe(0);
    expect(result.ratingDeltaB).toBe(0);
    expect(tracked.rating).toBe(1200);
  });

  it("projects tighter upset margins than favorite wins at extreme rating gaps", () => {
    const longshot = team("Longshot", 800);
    const favorite = team("Favorite", 2400);

    const upsetMargin = expectedMargin(longshot, favorite);
    const favoriteMargin = expectedMargin(favorite, longshot);

    expect(upsetMargin).toBeGreaterThanOrEqual(1);
    expect(upsetMargin).toBeLessThan(favoriteMargin);
  });

  it("uses live effective ratings after prior games in the same tournament state", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const state = createTournamentState([teamA, teamB]);

    simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0.5, 0.5]),
      tournamentState: state,
    });

    const liveA = effectiveRating(teamA, state);
    const liveB = effectiveRating(teamB, state);
    expect(liveA).toBeGreaterThan(liveB);

    const followUp = simulateGame(teamA, teamB, {
      rng: constantRng(0.01),
      tournamentState: state,
    });

    expect(followUp.winProbabilityA).toBeCloseTo(
      winProbabilityFor(liveA, liveB),
      5
    );
    expect(followUp.winProbabilityA).toBeGreaterThan(0.5);
  });

  it("projects score margins from live tournament ratings, not stale team objects", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const state = createTournamentState([teamA, teamB]);
    state.ratings.get(teamA.id)!.rating = 1700;
    teamA.rating = 1500;

    const seedResult = simulateGame(team("Alpha", 1500), team("Beta", 1500), {
      rng: sequenceRng([0.01, 0.5, 0]),
    });

    const liveResult = simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0.5, 0]),
      tournamentState: state,
    });

    expect(liveResult.winner).toBe(teamA);
    expect(liveResult.margin).toBeGreaterThan(seedResult.margin);
    expect(liveResult.margin).toBe(
      expectedMargin(team("Favorite", 1700), team("Underdog", 1500))
    );
  });

  it("grants a larger rating boost to an underdog upset than a comparable favorite win", () => {
    const probabilityA = winProbabilityFor(1700, 1500);
    const scoreRolls = [0.5, 0.5];

    const favoritePair = [team("Favorite", 1700), team("Underdog", 1500)];
    const favoriteState = createTournamentState(favoritePair);
    simulateGame(favoritePair[0], favoritePair[1], {
      rng: sequenceRng([0.01, ...scoreRolls]),
      tournamentState: favoriteState,
    });
    const favoriteGain = favoritePair[0].rating - 1700;

    const upsetPair = [team("Favorite", 1700), team("Underdog", 1500)];
    const upsetState = createTournamentState(upsetPair);
    simulateGame(upsetPair[0], upsetPair[1], {
      rng: sequenceRng([probabilityA, ...scoreRolls]),
      tournamentState: upsetState,
    });
    const upsetGain = upsetPair[1].rating - 1500;

    expect(upsetGain).toBeGreaterThan(favoriteGain);
  });

  it("preserves at least a one-point margin when score noise would collapse the spread", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);

    const result = simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0, 0]),
    });

    expect(result.margin).toBe(1);
    assertWinnerHasHigherScore(result, teamA);
  });
});

describe("expectedMargin edge cases", () => {
  it("never returns less than one regardless of rating gap direction", () => {
    const heavyFavorite = team("Goliath", 2400);
    const longshot = team("David", 800);

    expect(expectedMargin(heavyFavorite, longshot)).toBeGreaterThanOrEqual(1);
    expect(expectedMargin(longshot, heavyFavorite)).toBeGreaterThanOrEqual(1);
    expect(expectedMargin(team("EvenA", 1500), team("EvenB", 1500))).toBeGreaterThanOrEqual(
      1
    );
  });
});

describe("monteCarloChampionshipRates edge cases", () => {
  const field = [
    team("Duke", 1700),
    team("Kansas", 1550),
    team("UConn", 1400),
    team("Purdue", 1250),
  ];

  function simulateChampion(teams: typeof field) {
    return getChampion(simulateBracket(createBracket(teams)));
  }

  it("returns championship rates that sum to one across the field", () => {
    const rates = monteCarloChampionshipRates(field, 500, simulateChampion);
    const total = [...rates.values()].reduce((sum, rate) => sum + rate, 0);

    expect(rates.size).toBe(field.length);
    expect(total).toBeCloseTo(1, 10);
  });

  it("awards the top seed the highest rate over many iterations", () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    const rates = monteCarloChampionshipRates(field, 2000, (teams) =>
      getChampion(
        simulateBracket(createBracket(teams), { rng })
      )
    );

    const sorted = [...rates.entries()].sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe("duke");
    expect(sorted[0][1]).toBeGreaterThan(sorted[sorted.length - 1][1]);
  });

  it("does not mutate the original team objects between iterations", () => {
    const originals = field.map((entry) => ({ ...entry }));
    monteCarloChampionshipRates(field, 25, simulateChampion);

    for (let i = 0; i < field.length; i++) {
      expect(field[i]).toEqual(originals[i]);
    }
  });

  it("returns deterministic 1.0 and 0.0 rates for a two-team field", () => {
    const favorite = team("Favorite", 1800);
    const underdog = team("Underdog", 1200);
    const alwaysFavoriteWins = () =>
      getChampion(
        simulateBracket(createBracket([favorite, underdog]), {
          rng: sequenceRng([0, 0.5, 0.5]),
        })
      );

    const rates = monteCarloChampionshipRates(
      [favorite, underdog],
      50,
      alwaysFavoriteWins
    );

    expect(rates.get(favorite.id)).toBe(1);
    expect(rates.get(underdog.id)).toBe(0);
  });

  it("throws when zero iterations are requested", () => {
    expect(() =>
      monteCarloChampionshipRates(field, 0, simulateChampion)
    ).toThrow(/At least one iteration/);
  });

  it("throws when negative iterations are requested", () => {
    expect(() =>
      monteCarloChampionshipRates(field, -5, simulateChampion)
    ).toThrow(/At least one iteration/);
  });

  it("keeps championship rates normalized when dynamic ratings are enabled", () => {
    let iteration = 0;
    const rates = monteCarloChampionshipRates(field, 250, (teams) => {
      const rng = createSeededRng(6000 + iteration);
      iteration += 1;
      return getChampion(
        simulateBracket(createBracket(teams), { dynamicRatings: true, rng })
      );
    });
    const total = [...rates.values()].reduce((sum, rate) => sum + rate, 0);

    expect(total).toBeCloseTo(1, 10);
  });

  it("produces different championship rates when dynamic ratings are enabled", () => {
    let iteration = 0;
    const championWith = (dynamicRatings: boolean) => (teams: typeof field) => {
      const rng = createSeededRng(9000 + iteration);
      iteration += 1;
      return getChampion(
        simulateBracket(createBracket(teams), { dynamicRatings, rng })
      );
    };

    iteration = 0;
    const staticRates = monteCarloChampionshipRates(
      field,
      500,
      championWith(false)
    );
    iteration = 0;
    const dynamicRates = monteCarloChampionshipRates(
      field,
      500,
      championWith(true)
    );

    const differs = field.some(
      (entry) =>
        Math.abs(
          (staticRates.get(entry.id) ?? 0) - (dynamicRates.get(entry.id) ?? 0)
        ) > 0
    );
    expect(differs).toBe(true);
  });

  it("assigns a single 1.0 rate to the champion when only one iteration runs", () => {
    const rates = monteCarloChampionshipRates(field, 1, (teams) =>
      getChampion(
        simulateBracket(createBracket(teams), {
          rng: createSeededRng(2026),
        })
      )
    );

    const winners = [...rates.values()].filter((rate) => rate === 1);
    const losers = [...rates.values()].filter((rate) => rate === 0);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(field.length - 1);
    expect([...rates.values()].reduce((sum, rate) => sum + rate, 0)).toBe(1);
  });

  it("records championship rates for a champion returned outside the input field", () => {
    const outsider = team("Outsider", 1700);

    const rates = monteCarloChampionshipRates(field, 20, () => outsider);

    expect(rates.get(outsider.id)).toBe(1);
    expect(rates.get(field[0].id)).toBe(0);
    expect(rates.get(field[1].id)).toBe(0);
    expect(rates.size).toBe(field.length + 1);
    expect([...rates.values()].reduce((sum, rate) => sum + rate, 0)).toBe(1);
  });

  it("spreads championship rates evenly across an equal-strength field", () => {
    const evenField = [
      team("EvenA", 1500),
      team("EvenB", 1500),
      team("EvenC", 1500),
      team("EvenD", 1500),
    ];
    let seed = 4242;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    const rates = monteCarloChampionshipRates(evenField, 2000, (teams) =>
      getChampion(simulateBracket(createBracket(teams), { rng }))
    );

    for (const entry of evenField) {
      const rate = rates.get(entry.id) ?? 0;
      expect(rate).toBeGreaterThan(0.15);
      expect(rate).toBeLessThan(0.35);
    }
  });
});

describe("monteCarloGameOutcomes edge cases", () => {
  it("does not mutate the original team objects between iterations", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const originals = [{ ...teamA }, { ...teamB }];

    monteCarloGameOutcomes(teamA, teamB, 25, {
      rng: createSeededRng(11),
    });

    expect(teamA).toEqual(originals[0]);
    expect(teamB).toEqual(originals[1]);
  });

  it("tracks rating updates independently on each dynamic-ratings trial", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const state = createTournamentState([teamA, teamB]);

    const result = monteCarloGameOutcomes(teamA, teamB, 10, {
      rng: createSeededRng(5),
      tournamentState: state,
    });

    expect(result.winRateA + result.winRateB).toBeCloseTo(1, 10);
    expect(teamA.rating).toBe(1500);
    expect(teamB.rating).toBe(1500);
  });

  it("throws when negative iterations are requested", () => {
    expect(() =>
      monteCarloGameOutcomes(team("A", 1500), team("B", 1500), -1)
    ).toThrow(/At least one iteration/);
  });

  it("returns a degenerate win rate for a single iteration", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);

    const result = monteCarloGameOutcomes(teamA, teamB, 1, {
      rng: createSeededRng(77),
    });

    expect(result.winRateA + result.winRateB).toBe(1);
    expect([0, 1]).toContain(result.winRateA);
    expect(result.sampleResult.winner.id).toBe(
      result.winRateA === 1 ? teamA.id : teamB.id
    );
  });

  it("uses the first iteration as sampleResult across longer runs", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const seed = 808;

    const single = monteCarloGameOutcomes(teamA, teamB, 1, {
      rng: createSeededRng(seed),
    });
    const batch = monteCarloGameOutcomes(teamA, teamB, 40, {
      rng: createSeededRng(seed),
    });

    expect(batch.sampleResult).toEqual(single.sampleResult);
  });

  it("converges toward the analytical win rate over many trials", () => {
    const teamA = team("Alpha", 1650);
    const teamB = team("Beta", 1500);

    const result = monteCarloGameOutcomes(teamA, teamB, 5000, {
      rng: createSeededRng(314),
    });

    expect(result.winRateA).toBeGreaterThan(result.analyticalWinRateA - 0.08);
    expect(result.winRateA).toBeLessThan(result.analyticalWinRateA + 0.08);
  });

  it("reports aggregate stats that match a manual summation over iterations", () => {
    const teamA = team("Alpha", 1625);
    const teamB = team("Beta", 1500);
    const iterations = 12;
    const seed = 24680;
    const rng = createSeededRng(seed);

    const manual = computeGameOutcomeAggregates(teamA, teamB, iterations, rng);
    const result = monteCarloGameOutcomes(teamA, teamB, iterations, {
      rng: createSeededRng(seed),
    });

    expect(result.winRateA).toBe(manual.winRateA);
    expect(result.winRateB).toBe(manual.winRateB);
    expect(result.upsetRate).toBe(manual.upsetRate);
    expect(result.avgMargin).toBe(manual.avgMargin);
    expect(result.avgScoreA).toBe(manual.avgScoreA);
    expect(result.avgScoreB).toBe(manual.avgScoreB);
  });

  it("treats a caller-provided tournamentState as a boolean flag only", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const state = createTournamentState([teamA, teamB]);
    const startingRatingA = state.ratings.get(teamA.id)?.rating ?? 0;
    const startingRatingB = state.ratings.get(teamB.id)?.rating ?? 0;

    monteCarloGameOutcomes(teamA, teamB, 8, {
      rng: createSeededRng(33),
      tournamentState: state,
    });

    expect(state.ratings.get(teamA.id)?.rating).toBe(startingRatingA);
    expect(state.ratings.get(teamB.id)?.rating).toBe(startingRatingB);
    expect(teamA.rating).toBe(1500);
    expect(teamB.rating).toBe(1500);
  });

  it("reports zero upset rate when both teams share the same rating", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);

    const result = monteCarloGameOutcomes(teamA, teamB, 100, {
      rng: createSeededRng(31415),
    });

    expect(result.upsetRate).toBe(0);
  });

  it("derives analyticalWinRateA from pre-modified tournament state ratings", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const state = createTournamentState([teamA, teamB]);

    simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0.5, 0.5]),
      tournamentState: state,
    });

    const liveA = effectiveRating(teamA, state);
    const liveB = effectiveRating(teamB, state);

    const result = monteCarloGameOutcomes(teamA, teamB, 5, {
      rng: createSeededRng(99),
      tournamentState: state,
    });

    expect(result.analyticalWinRateA).toBeCloseTo(
      winProbabilityFor(liveA, liveB),
      5
    );
    expect(result.analyticalWinRateA).not.toBeCloseTo(0.5, 5);
  });
});

describe("simulateBracket edge cases", () => {
  it("throws when fewer than two teams are supplied to createBracket", () => {
    expect(() => createBracket([team("Lonely", 1500)])).toThrow(
      /At least two teams/
    );
  });

  it("throws when getChampion is called on an unsimulated bracket", () => {
    const bracket = createBracket(parseTeams(["Alpha", "Beta"]));
    expect(() => getChampion(bracket)).toThrow(/not been simulated/);
  });

  it("throws when a non-BYE match is missing a participant", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D"]));
    bracket.matches[0].teamA = null;

    expect(() => simulateBracket(bracket)).toThrow(/Incomplete match/);
  });

  it("simulates a two-team bracket in a single match", () => {
    const teams = parseTeams(["Alpha", "Beta"]).map((entry, index) => ({
      ...entry,
      rating: 1600 - index * 100,
    }));
    const bracket = createBracket(teams);

    expect(bracket.rounds).toBe(1);
    expect(bracket.matches).toHaveLength(1);

    const result = simulateBracket(bracket, {
      rng: sequenceRng([0.01, 0.5, 0.5]),
    });
    const finalMatch = result.matches[0];

    expect(finalMatch.winner).toBeTruthy();
    expect(finalMatch.scoreA).toBeDefined();
    expect(finalMatch.scoreB).toBeDefined();
    expect(getChampion(result).id).toBe(finalMatch.winner!.id);
  });

  it("does not mutate the input bracket object", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D"]));
    const snapshot = structuredClone(bracket);

    simulateBracket(bracket, { rng: sequenceRng([0.1, 0.5, 0.5, 0.1, 0.5, 0.5, 0.1, 0.5, 0.5]) });

    expect(bracket).toEqual(snapshot);
  });

  it("replays identically when driven by createSeededRng", () => {
    const teams = parseTeams(["S1", "S2", "S3", "S4"]).map((entry, index) => ({
      ...entry,
      rating: 1650 - index * 50,
    }));
    const rng = createSeededRng(4242);

    const first = simulateBracket(createBracket(teams), { rng });
    const second = simulateBracket(createBracket(teams), {
      rng: createSeededRng(4242),
    });

    expect(getChampion(first).id).toBe(getChampion(second).id);
    for (let i = 0; i < first.matches.length; i++) {
      expect(first.matches[i].scoreA).toBe(second.matches[i].scoreA);
      expect(first.matches[i].scoreB).toBe(second.matches[i].scoreB);
    }
  });

  it("leaves seed ratings unchanged when dynamicRatings is disabled", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map(
      (entry, index) => ({ ...entry, rating: 1600 - index * 80 })
    );
    const startingRatings = new Map(teams.map((entry) => [entry.id, entry.rating]));

    const result = simulateBracket(createBracket(teams), {
      rng: sequenceRng([0.1, 0.5, 0.5, 0.1, 0.5, 0.5, 0.1, 0.5, 0.5]),
    });

    for (const entry of result.teams) {
      if (entry.name === "BYE") {
        continue;
      }
      expect(entry.rating).toBe(startingRatings.get(entry.id));
    }
  });

  it("auto-advances BYE matches without recording scores", () => {
    const teams = parseTeams(["S1", "S2", "S3"]).map((entry, index) => ({
      ...entry,
      rating: 1650 - index * 100,
    }));
    const result = simulateBracket(createBracket(teams));

    for (const match of byeMatches(result)) {
      expect(match.winner).toBeTruthy();
      expect(match.scoreA).toBeUndefined();
      expect(match.scoreB).toBeUndefined();
    }
  });

  it("auto-advances team B when team A is a BYE placeholder", () => {
    const bracket = createBracket(
      parseTeams(["S1", "S2", "S3"]).map((entry, index) => ({
        ...entry,
        rating: 1650 - index * 100,
      }))
    );
    const byeMatch = byeMatches(bracket)[0];
    const recipient = byeMatch.teamA!;
    const bye = byeMatch.teamB!;

    expect(bye.name).toBe("BYE");
    byeMatch.teamA = bye;
    byeMatch.teamB = recipient;

    const result = simulateBracket(bracket);
    const simulatedByeMatch = byeMatches(result)[0];

    expect(simulatedByeMatch.winner?.id).toBe(recipient.id);
    expect(simulatedByeMatch.winner?.name).toBe(recipient.name);
    expect(simulatedByeMatch.scoreA).toBeUndefined();
    expect(simulatedByeMatch.scoreB).toBeUndefined();
    expect(getChampion(result).name).not.toBe("BYE");
  });

  it("simulates eight-team brackets with consistent round structure", () => {
    const teams = parseTeams([
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
      "S8",
    ]).map((entry, index) => ({ ...entry, rating: 1700 - index * 25 }));

    const bracket = createBracket(teams);
    expect(bracket.rounds).toBe(3);
    expect(roundOneMatches(bracket)).toHaveLength(4);

    const result = simulateBracket(bracket);
    assertBracketSimulationInvariants(result);
    expect(getChampion(result).name).toMatch(/^S\d$/);
  });

  it("uses updated ratings in later rounds when dynamicRatings is enabled", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map(
      (entry, index) => ({ ...entry, rating: 1600 - index * 80 })
    );
    const bracket = createBracket(teams);

    const roundOneFavorite = roundOneMatches(bracket)[0].teamA!;
    const roundOneUnderdog = roundOneMatches(bracket)[0].teamB!;
    const preRoundTwoRating = roundOneFavorite.rating;

    const result = simulateBracket(bracket, {
      dynamicRatings: true,
      rng: sequenceRng([
        0.99, 0.5, 0.5,
        0.1, 0.5, 0.5,
        0.1, 0.5, 0.5,
      ]),
    });

    const roundOne = result.matches.find(
      (match) => match.round === 0 && match.scoreA !== undefined
    );
    expect(roundOne?.winner?.id).toBe(roundOneUnderdog.id);

    const updatedFavoriteRating = result.teams.find(
      (entry) => entry.id === roundOneFavorite.id
    )?.rating;
    expect(updatedFavoriteRating).toBeLessThan(preRoundTwoRating);

    const semifinal = result.matches.find((match) => match.round === 1);
    expect(semifinal?.teamA?.rating ?? semifinal?.teamB?.rating).not.toBe(
      preRoundTwoRating
    );
  });

  it("simulates sixteen-team brackets with four rounds", () => {
    const teams = ratedField(16, 1700, 20);
    const bracket = createBracket(teams);

    expect(bracket.rounds).toBe(4);
    expect(roundOneMatches(bracket)).toHaveLength(8);
    expect(byeMatches(bracket)).toHaveLength(0);

    const result = simulateBracket(bracket, { rng: createSeededRng(999) });
    assertBracketSimulationInvariants(result);
    expect(getChampion(result).name).toMatch(/^S\d+$/);
  });

  it("handles seven-team fields with a single BYE auto-advance", () => {
    const teams = parseTeams([
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
    ]).map((entry, index) => ({ ...entry, rating: 1650 - index * 40 }));

    const bracket = createBracket(teams);
    expect(byeMatches(bracket)).toHaveLength(1);

    const result = simulateBracket(bracket, { rng: createSeededRng(777) });
    assertBracketSimulationInvariants(result);
    expect(getChampion(result).name).not.toBe("BYE");
  });

  it("handles six-team fields with two BYE auto-advances", () => {
    const teams = parseTeams(["S1", "S2", "S3", "S4", "S5", "S6"]).map(
      (entry, index) => ({ ...entry, rating: 1650 - index * 45 })
    );

    const bracket = createBracket(teams);
    expect(byeMatches(bracket)).toHaveLength(2);

    const result = simulateBracket(bracket);
    assertBracketSimulationInvariants(result);
    expect(getChampion(result).name).not.toBe("BYE");
  });

  it("propagates semifinal winners into the correct final slots", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map(
      (entry, index) => ({ ...entry, rating: 1600 - index * 100 })
    );
    const bracket = createBracket(teams);

    const result = simulateBracket(bracket, {
      rng: sequenceRng([
        0.01, 0.5, 0.5,
        0.99, 0.5, 0.5,
        0.01, 0.5, 0.5,
      ]),
    });

    const semifinals = matchesInRound(result, 0);
    const championship = finalMatch(result);

    expect(championship.teamA?.id).toBe(semifinals[0].winner?.id);
    expect(championship.teamB?.id).toBe(semifinals[1].winner?.id);
  });

  it.each([5, 9, 10, 11, 12, 13, 14, 15])(
    "simulates %i-team fields with the expected BYE padding",
    (teamCount) => {
      const teams = ratedField(teamCount);
      const bracket = createBracket(teams);

      expect(byeMatches(bracket)).toHaveLength(expectedByeCount(teamCount));
      expect(bracket.teams).toHaveLength(
        Math.pow(2, Math.ceil(Math.log2(teamCount)))
      );

      const result = simulateBracket(bracket, {
        rng: createSeededRng(1000 + teamCount),
      });
      assertBracketSimulationInvariants(result);
      expect(getChampion(result).name).not.toBe("BYE");
    }
  );

  it("simulates thirty-two-team brackets with five rounds", () => {
    const teams = ratedField(32, 1800, 15);
    const bracket = createBracket(teams);

    expect(bracket.rounds).toBe(5);
    expect(roundOneMatches(bracket)).toHaveLength(16);
    expect(byeMatches(bracket)).toHaveLength(0);

    const result = simulateBracket(bracket, { rng: createSeededRng(32000) });
    assertBracketSimulationInvariants(result);
    expect(getChampion(result).name).toMatch(/^S\d+$/);
  });

  it("simulates sixty-four-team brackets with six rounds", () => {
    const teams = ratedField(64, 1900, 10);
    const bracket = createBracket(teams);

    expect(bracket.rounds).toBe(6);
    expect(roundOneMatches(bracket)).toHaveLength(32);
    expect(byeMatches(bracket)).toHaveLength(0);

    const result = simulateBracket(bracket, { rng: createSeededRng(64000) });
    assertBracketSimulationInvariants(result);
    expect(getChampion(result).name).toMatch(/^S\d+$/);
  });

  it("counts only scored matches toward a BYE recipient's games played", () => {
    const teams = parseTeams(["S1", "S2", "S3"]).map((entry, index) => ({
      ...entry,
      rating: 1700 - index * 50,
    }));
    const bracket = createBracket(teams);
    const topSeed = [...teams].sort((a, b) => b.rating - a.rating)[0];

    const result = simulateBracket(bracket, {
      dynamicRatings: true,
      rng: createSeededRng(3333),
    });

    expect(playedMatchesForTeam(result, topSeed.id)).toHaveLength(1);
    expect(byeMatches(result).some((match) => match.winner?.id === topSeed.id)).toBe(
      true
    );
  });

  it("can replay simulation on an already simulated bracket clone", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map(
      (entry, index) => ({ ...entry, rating: 1600 - index * 75 })
    );
    const first = simulateBracket(createBracket(teams), {
      rng: createSeededRng(1212),
    });

    const replay = simulateBracket(structuredClone(first), {
      rng: createSeededRng(3434),
    });

    assertBracketSimulationInvariants(replay);
    expect(getChampion(replay).name).not.toBe("BYE");
  });
});

describe("tournamentState edge cases", () => {
  it("returns zero deltas when recording a result against a BYE placeholder", () => {
    const realA = team("RealA", 1500);
    const realB = team("RealB", 1480);
    const bye = team("BYE", 0, "bye-0");
    const state = createTournamentState([realA, realB]);

    const deltas = recordGameResult(state, realA, bye, 72, 58);
    expect(deltas).toEqual({ ratingDeltaA: 0, ratingDeltaB: 0 });
    expect(realA.rating).toBe(1500);
  });

  it("excludes BYE placeholders from tournament rating state", () => {
    const state = createTournamentState([
      team("Alpha", 1500),
      team("BYE", 0, "bye-1"),
    ]);

    expect(state.ratings.has("alpha")).toBe(true);
    expect(state.ratings.has("bye-1")).toBe(false);
  });
});

describe("createSeededRng edge cases", () => {
  it("coerces zero and negative seeds into stable unsigned values", () => {
    const rngZeroA = createSeededRng(0);
    const rngZeroB = createSeededRng(0);
    const rngNegativeA = createSeededRng(-1);
    const rngNegativeB = createSeededRng(-1);

    const zeroSequenceA = Array.from({ length: 5 }, () => rngZeroA());
    const zeroSequenceB = Array.from({ length: 5 }, () => rngZeroB());
    const negativeSequenceA = Array.from({ length: 5 }, () => rngNegativeA());
    const negativeSequenceB = Array.from({ length: 5 }, () => rngNegativeB());

    expect(zeroSequenceA).toEqual(zeroSequenceB);
    expect(negativeSequenceA).toEqual(negativeSequenceB);
    expect(zeroSequenceA[0]).not.toBe(negativeSequenceA[0]);
  });

  it("always yields values in the half-open interval [0, 1)", () => {
    const rng = createSeededRng(13579);

    for (let i = 0; i < 500; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
