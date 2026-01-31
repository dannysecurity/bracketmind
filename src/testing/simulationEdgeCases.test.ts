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
  countingRng,
  expectedByeCount,
  expectedRngCallsForTeamCount,
  nonByeMatchCount,
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
      expectedMargin(teamA, teamB) +
        (Math.floor(rolls[1] * 11) - 5)
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

  it("uses a neutral round K multiplier when totalRounds is one", () => {
    const rolls = [0.01, 0.5, 0.5];

    const singleRoundA = team("SingleA", 1500);
    const singleRoundB = team("SingleB", 1500);
    const singleRoundState = createTournamentState([singleRoundA, singleRoundB]);
    simulateGame(singleRoundA, singleRoundB, {
      rng: sequenceRng(rolls),
      tournamentState: singleRoundState,
      round: 0,
      totalRounds: 1,
    });

    const defaultA = team("DefaultA", 1500);
    const defaultB = team("DefaultB", 1500);
    const defaultState = createTournamentState([defaultA, defaultB]);
    simulateGame(defaultA, defaultB, {
      rng: sequenceRng(rolls),
      tournamentState: defaultState,
    });

    const earlyA = team("EarlyA", 1500);
    const earlyB = team("EarlyB", 1500);
    const earlyState = createTournamentState([earlyA, earlyB]);
    simulateGame(earlyA, earlyB, {
      rng: sequenceRng(rolls),
      tournamentState: earlyState,
      round: 0,
      totalRounds: 3,
    });

    const singleRoundGain = singleRoundA.rating - 1500;
    const defaultGain = defaultA.rating - 1500;
    const earlyRoundGain = earlyA.rating - 1500;

    expect(singleRoundGain).toBe(defaultGain);
    expect(singleRoundGain).toBeGreaterThanOrEqual(earlyRoundGain);
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

  it("uses seed ratings when only team B is tracked in tournament state", () => {
    const untracked = team("Untracked", 1600);
    const tracked = team("Tracked", 1200);
    const state = createTournamentState([tracked]);
    const expectedProb = winProbabilityFor(1600, 1200);

    const result = simulateGame(untracked, tracked, {
      rng: constantRng(0.01),
      tournamentState: state,
    });

    expect(result.winProbabilityA).toBeCloseTo(expectedProb, 5);
    expect(effectiveRating(untracked, state)).toBe(1600);
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

  it("returns zero deltas when a tracked favorite beats an untracked opponent", () => {
    const tracked = team("Tracked", 1600);
    const untracked = team("Untracked", 1200);
    const state = createTournamentState([tracked]);

    const result = simulateGame(tracked, untracked, {
      rng: constantRng(0.01),
      tournamentState: state,
    });

    expect(result.winner).toBe(tracked);
    expect(result.ratingDeltaA).toBe(0);
    expect(result.ratingDeltaB).toBe(0);
    expect(untracked.rating).toBe(1200);
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

  it("reports margin as the absolute difference between both scores", () => {
    const teamA = team("Alpha", 1650);
    const teamB = team("Beta", 1400);
    const rollSets = [
      [0.01, 0.5, 0.5],
      [0.99, 0.5, 0.5],
      [0.5, 0, 0.99],
    ];

    for (const rolls of rollSets) {
      const result = simulateGame(teamA, teamB, { rng: sequenceRng(rolls) });
      expect(result.margin).toBe(Math.abs(result.scoreA - result.scoreB));
      assertWinnerHasHigherScore(result, teamA);
    }
  });

  it("assigns the higher box score to team B when they win as the favorite", () => {
    const underdog = team("Underdog", 1400);
    const favorite = team("Favorite", 1600);

    const result = simulateGame(underdog, favorite, {
      rng: sequenceRng([0.99, 0.5, 0.5]),
    });

    expect(result.winner).toBe(favorite);
    expect(result.scoreB).toBeGreaterThan(result.scoreA);
    expect(result.margin).toBe(result.scoreB - result.scoreA);
  });

  it("assigns the higher box score to team A when they win as the underdog", () => {
    const underdog = team("Underdog", 1400);
    const favorite = team("Favorite", 1600);
    const probabilityA = winProbabilityFor(underdog.rating, favorite.rating);

    const result = simulateGame(underdog, favorite, {
      rng: sequenceRng([0.01, 0.5, 0.5]),
    });

    expect(probabilityA).toBeLessThan(0.5);
    expect(result.winner).toBe(underdog);
    expect(result.scoreA).toBeGreaterThan(result.scoreB);
    expect(result.isUpset).toBe(true);
    expect(result.margin).toBe(result.scoreA - result.scoreB);
  });

  it("pins winner score spread at baseline and ceiling for the third RNG draw", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const marginNoise = Math.floor(0 * 11) - 5;
    const margin = Math.max(1, expectedMargin(teamA, teamB) + marginNoise);

    const minSpread = simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0, 0]),
    });
    const maxSpread = simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0, 0.999999]),
    });

    expect(minSpread.scoreA).toBe(68 + Math.floor(margin / 2));
    expect(minSpread.scoreB).toBe(minSpread.scoreA - margin);
    expect(maxSpread.scoreA).toBe(68 + 11 + Math.floor(margin / 2));
    expect(maxSpread.scoreB).toBe(maxSpread.scoreA - margin);
  });

  it("never produces tied scores across many deterministic rolls", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1600);

    for (let seed = 1; seed <= 50; seed++) {
      const result = simulateGame(teamA, teamB, {
        rng: createSeededRng(seed),
      });

      expect(result.scoreA).not.toBe(result.scoreB);
      expect(result.margin).toBeGreaterThanOrEqual(1);
      assertWinnerHasHigherScore(result, teamA);
    }
  });

  it("increments gamesPlayed on both teams across chained simulateGame calls", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const state = createTournamentState([teamA, teamB]);
    const rolls = [0.01, 0.5, 0.5];

    for (let i = 0; i < 3; i++) {
      simulateGame(teamA, teamB, {
        rng: sequenceRng(rolls),
        tournamentState: state,
      });
    }

    expect(state.ratings.get(teamA.id)?.gamesPlayed).toBe(3);
    expect(state.ratings.get(teamB.id)?.gamesPlayed).toBe(3);
  });

  it("conserves total rating points when simulateGame updates tournament state", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const state = createTournamentState([teamA, teamB]);
    const startingTotal =
      (state.ratings.get(teamA.id)?.rating ?? 0) +
      (state.ratings.get(teamB.id)?.rating ?? 0);

    simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0.5, 0.5]),
      tournamentState: state,
    });

    const endingTotal =
      (state.ratings.get(teamA.id)?.rating ?? 0) +
      (state.ratings.get(teamB.id)?.rating ?? 0);

    expect(endingTotal).toBe(startingTotal);
  });

  it("compresses realized margin below the projected spread when the loser floor binds", () => {
    const favorite = team("Favorite", 2400);
    const underdog = team("Longshot", 800);
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
    expect(result.margin).toBe(result.scoreA - result.scoreB);
    expect(result.margin).toBeLessThan(projectedMargin);
  });

  it("ignores round metadata when no tournament state is provided", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);

    const withoutRound = simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0.5, 0.5]),
    });
    const withRound = simulateGame(teamA, teamB, {
      rng: sequenceRng([0.01, 0.5, 0.5]),
      round: 2,
      totalRounds: 4,
    });

    expect(withRound.ratingDeltaA).toBeUndefined();
    expect(withRound.ratingDeltaB).toBeUndefined();
    expect(withRound.winner).toEqual(withoutRound.winner);
    expect(withRound.scoreA).toBe(withoutRound.scoreA);
    expect(withRound.scoreB).toBe(withoutRound.scoreB);
  });

  it("respects score floors and minimum margin under maximum noise rolls", () => {
    const favorite = team("Favorite", 2100);
    const underdog = team("Underdog", 1100);

    const result = simulateGame(favorite, underdog, {
      rng: sequenceRng([0.01, 0.99, 0.99]),
    });

    expect(result.winner).toBe(favorite);
    expect(result.scoreA).toBeGreaterThanOrEqual(68);
    expect(result.scoreB).toBeGreaterThanOrEqual(55);
    expect(result.margin).toBeGreaterThanOrEqual(1);
    assertWinnerHasHigherScore(result, favorite);
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

  it("returns pinned margins at zero, moderate, and extreme rating gaps", () => {
    const evenA = team("EvenA", 1500);
    const evenB = team("EvenB", 1500);
    const moderateFavorite = team("ModerateFavorite", 1540);
    const moderateUnderdog = team("ModerateUnderdog", 1500);
    const heavyFavorite = team("HeavyFavorite", 1900);
    const longshot = team("Longshot", 1500);

    expect(expectedMargin(evenA, evenB)).toBe(5);
    expect(expectedMargin(moderateFavorite, moderateUnderdog)).toBe(6);
    expect(expectedMargin(heavyFavorite, longshot)).toBe(15);
    expect(expectedMargin(longshot, heavyFavorite)).toBe(9);
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

  it("records a champion from the callback when no input teams are supplied", () => {
    const outsider = team("Outsider", 1500);
    const rates = monteCarloChampionshipRates([], 25, () => outsider);

    expect(rates.size).toBe(1);
    expect(rates.get(outsider.id)).toBe(1);
  });

  it("assigns a single 1.0 rate when only one team is supplied", () => {
    const solo = team("Solo", 1600);
    const rates = monteCarloChampionshipRates([solo], 40, () => solo);

    expect(rates.size).toBe(1);
    expect(rates.get(solo.id)).toBe(1);
  });

  it("propagates errors thrown by the simulation callback", () => {
    expect(() =>
      monteCarloChampionshipRates(field, 5, () => {
        throw new Error("bracket simulation failed");
      })
    ).toThrow(/bracket simulation failed/);
  });

  it("spreads championship rates evenly across an eight-team equal-strength field", () => {
    const evenField = Array.from({ length: 8 }, (_, index) =>
      team(`Even${index + 1}`, 1500)
    );
    let seed = 5150;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    const rates = monteCarloChampionshipRates(evenField, 4000, (teams) =>
      getChampion(simulateBracket(createBracket(teams), { rng }))
    );

    for (const entry of evenField) {
      const rate = rates.get(entry.id) ?? 0;
      expect(rate).toBeGreaterThan(0.05);
      expect(rate).toBeLessThan(0.25);
    }
    expect([...rates.values()].reduce((sum, rate) => sum + rate, 0)).toBeCloseTo(
      1,
      10
    );
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

  it("throws when zero iterations are requested", () => {
    expect(() =>
      monteCarloGameOutcomes(team("A", 1500), team("B", 1500), 0)
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
    expect(result.marginStdDev).toBeCloseTo(manual.marginStdDev, 10);
    expect(result.marginPercentiles).toEqual(manual.marginPercentiles);
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

  it("passes round metadata through to each fresh tournament-state trial", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const state = createTournamentState([teamA, teamB]);
    const rolls = [0.01, 0.5, 0.5];

    const early = monteCarloGameOutcomes(teamA, teamB, 1, {
      rng: sequenceRng(rolls),
      tournamentState: state,
      round: 0,
      totalRounds: 3,
    });
    const late = monteCarloGameOutcomes(teamA, teamB, 1, {
      rng: sequenceRng(rolls),
      tournamentState: state,
      round: 2,
      totalRounds: 3,
    });

    expect(late.sampleResult.ratingDeltaA).toBeGreaterThan(
      early.sampleResult.ratingDeltaA!
    );
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

  it("converges upset rate toward the analytical underdog win probability", () => {
    const favorite = team("Favorite", 2400);
    const longshot = team("Longshot", 800);
    const analyticalUpsetRate = 1 - winProbabilityFor(favorite.rating, longshot.rating);

    const result = monteCarloGameOutcomes(favorite, longshot, 8000, {
      rng: createSeededRng(271828),
    });

    expect(analyticalUpsetRate).toBeGreaterThan(0);
    expect(result.upsetRate).toBeGreaterThan(analyticalUpsetRate - 0.03);
    expect(result.upsetRate).toBeLessThan(analyticalUpsetRate + 0.03);
  });

  it("interpolates margin percentiles when exactly two trials are run", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const seed = 1618;
    const rng = createSeededRng(seed);

    const manual = computeGameOutcomeAggregates(teamA, teamB, 2, rng);
    const result = monteCarloGameOutcomes(teamA, teamB, 2, {
      rng: createSeededRng(seed),
    });

    expect(result.marginStdDev).toBeGreaterThan(0);
    expect(result.marginPercentiles).toEqual(manual.marginPercentiles);
    expect(result.marginPercentiles.p50).toBeGreaterThanOrEqual(
      Math.min(...[manual.marginPercentiles.p10, manual.marginPercentiles.p90])
    );
    expect(result.marginPercentiles.p50).toBeLessThanOrEqual(
      Math.max(...[manual.marginPercentiles.p10, manual.marginPercentiles.p90])
    );
  });

  it("interpolates margin percentiles when exactly three trials are run", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const seed = 3141;
    const rng = createSeededRng(seed);

    const manual = computeGameOutcomeAggregates(teamA, teamB, 3, rng);
    const result = monteCarloGameOutcomes(teamA, teamB, 3, {
      rng: createSeededRng(seed),
    });

    expect(result.marginStdDev).toBeGreaterThan(0);
    expect(result.marginPercentiles).toEqual(manual.marginPercentiles);
    expect(result.marginPercentiles.p10).toBeLessThanOrEqual(
      result.marginPercentiles.p50
    );
    expect(result.marginPercentiles.p50).toBeLessThanOrEqual(
      result.marginPercentiles.p90
    );
  });

  it("consumes three RNG draws for each iteration", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const iterations = 12;
    const { rng, callCount } = countingRng(createSeededRng(24601));

    monteCarloGameOutcomes(teamA, teamB, iterations, { rng });

    expect(callCount()).toBe(iterations * 3);
  });

  it("reports zero margin spread when every trial uses the same score rolls", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const sharedRolls = [0.25, 0.5, 0.5];

    const result = monteCarloGameOutcomes(teamA, teamB, 6, {
      rng: sequenceRng(sharedRolls),
    });

    expect(result.marginStdDev).toBe(0);
    expect(result.avgMargin).toBe(result.sampleResult.margin);
    expect(result.marginPercentiles.p10).toBe(result.marginPercentiles.p90);
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

  it("throws when a non-BYE match is missing team A", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D"]));
    bracket.matches[0].teamA = null;

    expect(() => simulateBracket(bracket)).toThrow(/Incomplete match/);
  });

  it("throws when a non-BYE match is missing team B", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D"]));
    bracket.matches[0].teamB = null;

    expect(() => simulateBracket(bracket)).toThrow(/Incomplete match/);
  });

  it("throws when both participants are missing from a non-BYE slot", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D"]));
    bracket.matches[0].teamA = null;
    bracket.matches[0].teamB = null;

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

  it("declares team B the winner when both sides of a match are BYE placeholders", () => {
    const bracket = createBracket(
      parseTeams(["S1", "S2", "S3"]).map((entry, index) => ({
        ...entry,
        rating: 1650 - index * 100,
      }))
    );
    const byeMatch = byeMatches(bracket)[0];
    const originalBye = byeMatch.teamB!;
    byeMatch.teamA = originalBye;
    byeMatch.teamB = team("BYE", 0, "bye-alt");

    const result = simulateBracket(bracket);
    const simulatedByeMatch = byeMatches(result).find(
      (match) => match.slot === byeMatch.slot
    );

    expect(simulatedByeMatch?.winner?.name).toBe("BYE");
    expect(simulatedByeMatch?.scoreA).toBeUndefined();
    expect(simulatedByeMatch?.scoreB).toBeUndefined();
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

  it("consumes exactly three RNG values per simulated game in an eight-team bracket", () => {
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
    const { rng, callCount } = countingRng(createSeededRng(90210));

    simulateBracket(bracket, { rng });

    expect(callCount()).toBe(expectedRngCallsForTeamCount(teams.length));
    expect(nonByeMatchCount(bracket)).toBeLessThan(teams.length - 1);
  });

  it("consumes no RNG values for BYE auto-advances in a three-team field", () => {
    const teams = parseTeams(["S1", "S2", "S3"]).map((entry, index) => ({
      ...entry,
      rating: 1700 - index * 50,
    }));
    const bracket = createBracket(teams);
    const { rng, callCount } = countingRng(createSeededRng(90210));

    simulateBracket(bracket, { rng });

    expect(byeMatches(bracket)).toHaveLength(1);
    expect(callCount()).toBe(expectedRngCallsForTeamCount(teams.length));
  });

  it("repeats a short RNG sequence deterministically across many matches", () => {
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
    const shortCycle = sequenceRng([0.01, 0.5, 0.5]);

    const first = simulateBracket(createBracket(teams), { rng: shortCycle });
    const second = simulateBracket(createBracket(teams), {
      rng: sequenceRng([0.01, 0.5, 0.5]),
    });

    expect(getChampion(first).id).toBe(getChampion(second).id);
    for (let i = 0; i < first.matches.length; i++) {
      expect(first.matches[i].scoreA).toBe(second.matches[i].scoreA);
      expect(first.matches[i].scoreB).toBe(second.matches[i].scoreB);
    }
  });

  it("leaves BYE recipients without scored matches until they face real opposition", () => {
    const teams = parseTeams(["S1", "S2", "S3"]).map((entry, index) => ({
      ...entry,
      rating: 1700 - index * 50,
    }));
    const topSeed = [...teams].sort((a, b) => b.rating - a.rating)[0];
    const result = simulateBracket(createBracket(teams), {
      dynamicRatings: true,
      rng: createSeededRng(4444),
    });

    const byeMatch = byeMatches(result).find(
      (match) => match.winner?.id === topSeed.id
    );
    expect(byeMatch).toBeTruthy();
    expect(byeMatch?.scoreA).toBeUndefined();
    expect(byeMatch?.scoreB).toBeUndefined();
    expect(playedMatchesForTeam(result, topSeed.id).length).toBeGreaterThan(0);
  });

  it("uses accumulated ratings when computing later-round win probabilities", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map(
      (entry, index) => ({ ...entry, rating: 1600 - index * 80 })
    );
    const bracket = createBracket(teams);
    const roundOneFavorite = roundOneMatches(bracket)[0].teamA!;
    const roundOneUnderdog = roundOneMatches(bracket)[0].teamB!;

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

    const favoriteAfterUpset = result.teams.find(
      (entry) => entry.id === roundOneFavorite.id
    )?.rating;
    const underdogAfterUpset = result.teams.find(
      (entry) => entry.id === roundOneUnderdog.id
    )?.rating;

    expect(favoriteAfterUpset).toBeLessThan(roundOneFavorite.rating);
    expect(underdogAfterUpset).toBeGreaterThan(roundOneUnderdog.rating);

    const semifinal = result.matches.find((match) => match.round === 1);
    const semifinalFavorite = semifinal?.teamA ?? semifinal?.teamB;
    const semifinalUnderdog =
      semifinal?.teamA?.id === semifinalFavorite?.id
        ? semifinal?.teamB
        : semifinal?.teamA;

    if (!semifinalFavorite || !semifinalUnderdog) {
      throw new Error("Expected a populated semifinal matchup");
    }

    const expectedSemifinalProb = winProbabilityFor(
      semifinalFavorite.rating,
      semifinalUnderdog.rating
    );
    expect(expectedSemifinalProb).not.toBeCloseTo(
      winProbabilityFor(roundOneFavorite.rating, roundOneUnderdog.rating),
      2
    );
  });

  it("conserves total rating points when dynamicRatings is enabled", () => {
    const teams = ratedField(8, 1700, 25);
    const startingTotal = teams.reduce((sum, entry) => sum + entry.rating, 0);

    const result = simulateBracket(createBracket(teams), {
      dynamicRatings: true,
      rng: createSeededRng(4242),
    });

    const endingTotal = result.teams
      .filter((entry) => entry.name !== "BYE")
      .reduce((sum, entry) => sum + entry.rating, 0);

    expect(endingTotal).toBe(startingTotal);
  });

  it("conserves total rating points for padded fields with BYE auto-advances", () => {
    const teams = parseTeams(["S1", "S2", "S3", "S4", "S5", "S6", "S7"]).map(
      (entry, index) => ({ ...entry, rating: 1650 - index * 40 })
    );
    const startingTotal = teams.reduce((sum, entry) => sum + entry.rating, 0);

    const result = simulateBracket(createBracket(teams), {
      dynamicRatings: true,
      rng: createSeededRng(777),
    });

    const endingTotal = result.teams
      .filter((entry) => entry.name !== "BYE")
      .reduce((sum, entry) => sum + entry.rating, 0);

    expect(endingTotal).toBe(startingTotal);
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

  it("conserves total rating points on a tied recorded result", () => {
    const teamA = team("TeamA", 1500);
    const teamB = team("TeamB", 1520);
    const state = createTournamentState([teamA, teamB]);
    const startingTotal =
      (state.ratings.get(teamA.id)?.rating ?? 0) +
      (state.ratings.get(teamB.id)?.rating ?? 0);

    recordGameResult(state, teamA, teamB, 70, 70, { margin: 0 });

    const endingTotal =
      (state.ratings.get(teamA.id)?.rating ?? 0) +
      (state.ratings.get(teamB.id)?.rating ?? 0);

    expect(endingTotal).toBe(startingTotal);
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

  it("truncates fractional seeds to unsigned 32-bit integers", () => {
    const fromFloat = createSeededRng(42.7);
    const fromInt = createSeededRng(42);

    expect(Array.from({ length: 5 }, () => fromFloat())).toEqual(
      Array.from({ length: 5 }, () => fromInt())
    );
  });

  it("wraps seed values that exceed the 32-bit unsigned range", () => {
    const base = createSeededRng(1);
    const wrapped = createSeededRng(0x1_0000_0001);

    expect(Array.from({ length: 5 }, () => base())).toEqual(
      Array.from({ length: 5 }, () => wrapped())
    );
  });
});
