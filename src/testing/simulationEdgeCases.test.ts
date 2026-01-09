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
  monteCarloChampionshipRates,
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
  constantRng,
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
