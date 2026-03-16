import { describe, expect, it } from "vitest";
import {
  createBracket,
  getChampion,
  simulateBracket,
} from "../bracket.js";
import { expectedScore } from "../ratings.js";
import { DEFAULT_HISTORICAL_WEIGHT } from "../probability/seedUpsets.js";
import { resolveWinProbabilityA } from "../probability/winProbability.js";
import {
  createScoreModel,
  createSeededRng,
  expectedMargin,
  monteCarloChampionshipRates,
  monteCarloGameOutcomes,
  simulateBestOfSeries,
  simulateGame,
} from "../simulator.js";
import {
  createTournamentState,
  effectiveRating,
} from "../tournamentState.js";
import {
  simulateBracketFromRound,
  simulateBracketThroughRound,
} from "./simulationBoundary.js";
import { assertRatingTotalConserved } from "./simulationContract.js";
import {
  assertBracketSimulationInvariants,
  constantRng,
  ratedField,
  sequenceRng,
  team,
  winProbabilityFor,
} from "./simulationFixtures.js";
import {
  assertSeriesRatingConserved,
  clampedBlendWinProbability,
  combinedBracketOptions,
  fullBlendGameOptions,
  mixedSeedField,
  roundAwareProbabilityDiffers,
  seededTeam,
  totalStateRatingPoints,
  winProbabilityAtRound,
} from "./simulationScenarios.js";

describe("round-aware historical blending in simulation", () => {
  it("produces different win probabilities for the same seeds at different rounds", () => {
    const diff = roundAwareProbabilityDiffers(1, 8, 0, 1, 1);

    expect(diff.historicalRateA).not.toBe(diff.historicalRateB);
    expect(diff.probabilityAtRoundA).not.toBeCloseTo(
      diff.probabilityAtRoundB,
      5
    );
  });

  it("passes the bracket round index through simulateGame during multi-round play", () => {
    const oneSeed = seededTeam("One", 1500, 1);
    const eightSeed = seededTeam("Eight", 1500, 8);
    const roundZero = winProbabilityAtRound(oneSeed, eightSeed, 0, 1);
    const roundOne = winProbabilityAtRound(oneSeed, eightSeed, 1, 1);

    const earlyRound = simulateGame(oneSeed, eightSeed, {
      seedA: 1,
      seedB: 8,
      round: 0,
      historicalWeight: 1,
      rng: constantRng(0.99),
    });
    const laterRound = simulateGame(oneSeed, eightSeed, {
      seedA: 1,
      seedB: 8,
      round: 1,
      historicalWeight: 1,
      rng: constantRng(0.99),
    });

    expect(earlyRound.winProbabilityA).toBeCloseTo(roundZero, 5);
    expect(laterRound.winProbabilityA).toBeCloseTo(roundOne, 5);
    expect(earlyRound.winProbabilityA).not.toBeCloseTo(
      laterRound.winProbabilityA,
      5
    );
  });

  it("uses later-round historical rates when simulating deep bracket matchups", () => {
    const teams = [
      seededTeam("S1", 1500, 1),
      seededTeam("S8", 1500, 8),
      seededTeam("S4", 1500, 4),
      seededTeam("S5", 1500, 5),
    ];

    const bracket = createBracket(teams);
    const partial = simulateBracketThroughRound(bracket, 0, {
      rng: sequenceRng([0.01, 0.5, 0.5, 0.99, 0.5, 0.5]),
      historicalWeight: 1,
    });

    const semifinal = partial.matches.find(
      (match) => match.round === 1 && match.slot === 0
    );
    expect(semifinal?.teamA).toBeDefined();
    expect(semifinal?.teamB).toBeDefined();

    const expectedProb = winProbabilityAtRound(
      semifinal!.teamA!,
      semifinal!.teamB!,
      1,
      1
    );

    const resumed = simulateBracketFromRound(partial, 1, {
      rng: constantRng(0.5),
      historicalWeight: 1,
    });
    const played = resumed.matches.find(
      (match) => match.round === 1 && match.scoreA !== undefined
    );

    expect(played?.scoreA).toBeDefined();
    expect(
      resolveWinProbabilityA(
        played!.teamA!,
        played!.teamB!,
        played!.teamA!.rating,
        played!.teamB!.rating,
        {
          seedA: played!.teamA!.seed,
          seedB: played!.teamB!.seed,
          historicalWeight: 1,
          round: 1,
        }
      )
    ).toBeCloseTo(expectedProb, 5);
  });
});

describe("dynamicRatings with historicalWeight", () => {
  it("updates live ratings while applying seed upset blending in bracket play", () => {
    const teams = mixedSeedField(4, 4, 1600, 40);
    const seedTotal = teams.reduce((sum, entry) => sum + entry.rating, 0);

    const result = simulateBracket(createBracket(teams), {
      ...combinedBracketOptions(),
      rng: createSeededRng(90210),
    });

    assertBracketSimulationInvariants(result);
    assertRatingTotalConserved(seedTotal, result.teams.reduce(
      (sum, entry) => sum + entry.rating,
      0
    ));

    const firstRound = result.matches.find(
      (match) => match.round === 0 && match.scoreA !== undefined
    );
    const pureElo = expectedScore(
      firstRound!.teamA!.rating,
      firstRound!.teamB!.rating
    );
    const blended = resolveWinProbabilityA(
      firstRound!.teamA!,
      firstRound!.teamB!,
      firstRound!.teamA!.rating,
      firstRound!.teamB!.rating,
      {
        seedA: firstRound!.teamA!.seed,
        seedB: firstRound!.teamB!.seed,
        historicalWeight: DEFAULT_HISTORICAL_WEIGHT,
        round: 0,
      }
    );

    expect(blended).not.toBeCloseTo(pureElo, 3);
    expect(
      teams.some((entry) => entry.rating !== result.teams.find((t) => t.id === entry.id)?.rating)
    ).toBe(true);
  });

  it("preserves rating totals when resuming a partially simulated bracket", () => {
    const teams = mixedSeedField(8, 8, 1650, 30);
    const bracket = createBracket(teams);
    const seedTotal = teams.reduce((sum, entry) => sum + entry.rating, 0);

    const partial = simulateBracketThroughRound(bracket, 0, {
      ...combinedBracketOptions(),
      rng: createSeededRng(77),
    });

    const finished = simulateBracketFromRound(partial, 1, {
      ...combinedBracketOptions(),
      rng: createSeededRng(88),
    });

    assertBracketSimulationInvariants(finished);
    assertRatingTotalConserved(
      seedTotal,
      finished.teams.reduce((sum, entry) => sum + entry.rating, 0)
    );
    expect(getChampion(finished).name).not.toBe("BYE");
  });
});

describe("mixed seeded and unseeded fields", () => {
  it("falls back to pure Elo when one side lacks a tournament seed", () => {
    const seeded = seededTeam("Seeded", 1500, 1);
    const unseeded = team("Unseeded", 1500);

    const result = simulateGame(seeded, unseeded, {
      historicalWeight: DEFAULT_HISTORICAL_WEIGHT,
      rng: constantRng(0.1),
    });

    expect(result.winProbabilityA).toBeCloseTo(
      expectedScore(seeded.rating, unseeded.rating),
      5
    );
  });

  it("simulates brackets where only half the field carries seeds", () => {
    const teams = mixedSeedField(4, 2, 1600, 25);
    const result = simulateBracket(createBracket(teams), {
      historicalWeight: DEFAULT_HISTORICAL_WEIGHT,
      rng: sequenceRng([0.01, 0.5, 0.5, 0.01, 0.5, 0.5, 0.01, 0.5, 0.5]),
    });

    assertBracketSimulationInvariants(result);

    const mixedMatch = result.matches.find(
      (match) =>
        match.round === 0 &&
        match.scoreA !== undefined &&
        (match.teamA?.seed === undefined || match.teamB?.seed === undefined)
    );

    expect(mixedMatch).toBeDefined();
    expect(
      resolveWinProbabilityA(
        mixedMatch!.teamA!,
        mixedMatch!.teamB!,
        mixedMatch!.teamA!.rating,
        mixedMatch!.teamB!.rating,
        { historicalWeight: DEFAULT_HISTORICAL_WEIGHT, round: 0 }
      )
    ).toBeCloseTo(
      expectedScore(mixedMatch!.teamA!.rating, mixedMatch!.teamB!.rating),
      5
    );
  });
});

describe("historical weight boundary integration", () => {
  it("treats negative historical weight as pure Elo in simulateGame", () => {
    const underdog = seededTeam("Underdog", 1450, 16);
    const favorite = seededTeam("Favorite", 1700, 1);

    const result = simulateGame(underdog, favorite, {
      seedA: 16,
      seedB: 1,
      historicalWeight: -0.5,
      rng: constantRng(0.1),
    });

    expect(result.winProbabilityA).toBeCloseTo(
      expectedScore(underdog.rating, favorite.rating),
      5
    );
  });

  it("clamps historical weight above one to full historical blending", () => {
    const underdog = seededTeam("Underdog", 1500, 16);
    const favorite = seededTeam("Favorite", 1500, 1);
    const clamped = clampedBlendWinProbability(
      underdog,
      favorite,
      16,
      1,
      2
    );
    const full = clampedBlendWinProbability(underdog, favorite, 16, 1, 1);

    const overweight = simulateGame(underdog, favorite, {
      seedA: 16,
      seedB: 1,
      historicalWeight: 2,
      rng: constantRng(0.5),
    });
    const saturated = simulateGame(underdog, favorite, {
      seedA: 16,
      seedB: 1,
      historicalWeight: 1,
      rng: constantRng(0.5),
    });

    expect(clamped).toBeCloseTo(full, 10);
    expect(overweight.winProbabilityA).toBeCloseTo(saturated.winProbabilityA, 10);
    expect(overweight.winProbabilityA).toBeCloseTo(clamped, 10);
  });
});

describe("best-of series combined scenarios", () => {
  it("applies historical seed blending across every game in a seeded series", () => {
    const oneSeed = seededTeam("One", 1500, 1);
    const sixteenSeed = seededTeam("Sixteen", 1500, 16);
    const expected = resolveWinProbabilityA(
      oneSeed,
      sixteenSeed,
      oneSeed.rating,
      sixteenSeed.rating,
      { seedA: 1, seedB: 16, historicalWeight: 1 }
    );

    const series = simulateBestOfSeries(oneSeed, sixteenSeed, 3, {
      ...fullBlendGameOptions({ seedA: 1, seedB: 16 }),
      rng: sequenceRng([0.01, 0.5, 0.5, 0.01, 0.5, 0.5]),
    });

    expect(series.games).toHaveLength(2);
    for (const game of series.games) {
      expect(game.winProbabilityA).toBeCloseTo(expected, 5);
    }
  });

  it("conserves total rating points across a competitive best-of-seven with live state", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1590);
    const state = createTournamentState([teamA, teamB]);
    const beforeTotal = totalStateRatingPoints(state);
    const probabilityA = winProbabilityFor(teamA.rating, teamB.rating);

    const series = simulateBestOfSeries(teamA, teamB, 7, {
      tournamentState: state,
      rng: sequenceRng(
        Array.from({ length: 7 }, (_, index) =>
          index % 2 === 0
            ? [0.01, 0.5, 0.5]
            : [probabilityA, 0.5, 0.5]
        ).flat()
      ),
    });

    expect(series.games.length).toBeGreaterThanOrEqual(4);
    expect(series.games.length).toBeLessThanOrEqual(7);
    assertSeriesRatingConserved(
      beforeTotal,
      totalStateRatingPoints(state)
    );
    expect(effectiveRating(series.teamA, state)).toBe(series.teamA.rating);
    expect(effectiveRating(series.teamB, state)).toBe(series.teamB.rating);
  });

  it("rejects negative bestOf values before any games are simulated", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);

    expect(() => simulateBestOfSeries(teamA, teamB, -1)).toThrow(
      /bestOf must be a positive odd integer/
    );
  });
});

describe("score model extremes in simulation", () => {
  it("pins the winner score when winnerScoreSpread is zero", () => {
    const teamA = team("Alpha", 1650);
    const teamB = team("Beta", 1500);
    const model = createScoreModel({
      winnerScoreSpread: 0,
      marginNoiseRange: 0,
      baseWinnerScore: 70,
      loserScoreFloor: 55,
    });

    const result = simulateGame(teamA, teamB, {
      rng: constantRng(0),
      scoreModel: model,
    });

    const baseline = Math.max(1, expectedMargin(teamA, teamB));
    const expectedWinnerScore = 70 + Math.floor(baseline / 2);

    expect(result.winner.id).toBe(teamA.id);
    expect(result.scoreA).toBe(expectedWinnerScore);
    expect(result.scoreB).toBe(expectedWinnerScore - baseline);
  });
});

describe("Monte Carlo with combined simulation options", () => {
  it("tracks analytical rates under dynamic ratings and historical blending", () => {
    const underdog = seededTeam("UMBC", 1450, 16);
    const favorite = seededTeam("Virginia", 1700, 1);
    const state = createTournamentState([underdog, favorite]);
    const expected = resolveWinProbabilityA(
      underdog,
      favorite,
      underdog.rating,
      favorite.rating,
      { seedA: 16, seedB: 1, historicalWeight: DEFAULT_HISTORICAL_WEIGHT }
    );

    const result = monteCarloGameOutcomes(underdog, favorite, 4000, {
      tournamentState: state,
      historicalWeight: DEFAULT_HISTORICAL_WEIGHT,
      seedA: 16,
      seedB: 1,
      rng: createSeededRng(31415),
    });

    expect(result.analyticalWinRateA).toBeCloseTo(expected, 5);
    expect(result.winRateA).toBeGreaterThan(expected - 0.08);
    expect(result.winRateA).toBeLessThan(expected + 0.08);
  });

  it("runs championship Monte Carlo with historical blend in the bracket callback", () => {
    const teams = mixedSeedField(8, 8, 1600, 25);
    let seed = 1618;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    const rates = monteCarloChampionshipRates(teams, 200, (field) =>
      getChampion(
        simulateBracket(createBracket(field), {
          historicalWeight: DEFAULT_HISTORICAL_WEIGHT,
          rng,
        })
      )
    );

    const total = [...rates.values()].reduce((sum, rate) => sum + rate, 0);
    expect(total).toBeCloseTo(1, 5);
    expect([...rates.values()].every((rate) => rate >= 0)).toBe(true);
    expect([...rates.values()].some((rate) => rate > 0)).toBe(true);
  });
});
