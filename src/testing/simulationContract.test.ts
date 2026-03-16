import { describe, expect, it } from "vitest";
import { createBracket, getChampion, simulateBracket } from "../bracket.js";
import { defaultRatingModel } from "../ratingsModel.js";
import {
  createSeededRng,
  monteCarloGameOutcomes,
  simulateGame,
  wilsonScoreInterval,
} from "../simulator.js";
import {
  assertRatingTotalConserved,
  assertWilsonIntervalContract,
  customRatingModel,
  forEachSimulationSeed,
  simulateRatedField,
  totalLiveRatingPoints,
  totalSeedRatingPoints,
  tournamentStateWithHistory,
} from "./simulationContract.js";
import {
  assertBracketSimulationInvariants,
  constantRng,
  countingRng,
  expectedRngCallsForTeamCount,
  priorGamesMap,
  ratedField,
  sequenceRng,
  team,
  winProbabilityFor,
} from "./simulationFixtures.js";

describe("wilsonScoreInterval contract", () => {
  it("returns zero bounds when trials are zero or negative", () => {
    for (const trials of [0, -1, -100]) {
      const interval = wilsonScoreInterval(0, trials);
      assertWilsonIntervalContract(interval, 0, trials);
      expect(interval).toEqual({ low: 0, high: 0 });
    }
  });

  it("brackets perfect and zero win rates", () => {
    const allWins = wilsonScoreInterval(500, 500);
    assertWilsonIntervalContract(allWins, 500, 500);
    expect(allWins.low).toBeGreaterThan(0.99);
    expect(allWins.high).toBeCloseTo(1, 10);

    const allLosses = wilsonScoreInterval(0, 500);
    assertWilsonIntervalContract(allLosses, 0, 500);
    expect(allLosses.low).toBe(0);
    expect(allLosses.high).toBeLessThan(0.01);
  });

  it("widens intervals when a higher z critical value is used", () => {
    const successes = 712;
    const trials = 1000;
    const narrow = wilsonScoreInterval(successes, trials, 1.96);
    const wide = wilsonScoreInterval(successes, trials, 2.576);

    assertWilsonIntervalContract(narrow, successes, trials);
    assertWilsonIntervalContract(wide, successes, trials);
    expect(wide.high - wide.low).toBeGreaterThan(narrow.high - narrow.low);
  });

  it("keeps bounds inside [0, 1] for representative success counts", () => {
    const cases: Array<[number, number]> = [
      [0, 10],
      [10, 10],
      [1, 1000],
      [999, 1000],
      [250, 1000],
    ];

    for (const [successes, trials] of cases) {
      const interval = wilsonScoreInterval(successes, trials);
      assertWilsonIntervalContract(interval, successes, trials);
    }
  });
});

describe("ratingModel propagation", () => {
  const favorite = team("Favorite", 1700);
  const underdog = team("Underdog", 1500);
  const upsetRoll = winProbabilityFor(favorite.rating, underdog.rating);
  const scoreRolls = [0.5, 0.5];

  it("applies a higher upsetBonus through simulateGame", () => {
    const defaultModel = defaultRatingModel();
    const boostedModel = customRatingModel({ upsetBonus: 0.25 });

    const defaultFavorite = team("Favorite", 1700);
    const defaultUnderdog = team("Underdog", 1500);
    const defaultState = tournamentStateWithHistory([
      defaultFavorite,
      defaultUnderdog,
    ]);
    simulateGame(defaultFavorite, defaultUnderdog, {
      rng: sequenceRng([upsetRoll, ...scoreRolls]),
      tournamentState: defaultState,
      ratingModel: defaultModel,
    });
    const defaultGain = defaultUnderdog.rating - 1500;

    const boostedFavorite = team("Favorite", 1700);
    const boostedUnderdog = team("Underdog", 1500);
    const boostedState = tournamentStateWithHistory([
      boostedFavorite,
      boostedUnderdog,
    ]);
    simulateGame(boostedFavorite, boostedUnderdog, {
      rng: sequenceRng([upsetRoll, ...scoreRolls]),
      tournamentState: boostedState,
      ratingModel: boostedModel,
    });
    const boostedGain = boostedUnderdog.rating - 1500;

    expect(boostedGain).toBeGreaterThan(defaultGain);
  });

  it("changes final ratings when a custom ratingModel reshapes dynamic updates", () => {
    const teams = ratedField(4, 1600, 80);
    const rollValues = [
      0.99, 0.5, 0.5,
      0.1, 0.5, 0.5,
      0.1, 0.5, 0.5,
    ];

    const defaultResult = simulateBracket(createBracket(teams), {
      dynamicRatings: true,
      rng: sequenceRng(rollValues),
    });
    const customResult = simulateBracket(createBracket(teams), {
      dynamicRatings: true,
      rng: sequenceRng(rollValues),
      ratingModel: customRatingModel({ upsetBonus: 0.2, baseKFactor: 40 }),
    });

    const ratingDiffers = teams.some((entry) => {
      const defaultTeam = defaultResult.teams.find((t) => t.id === entry.id);
      const customTeam = customResult.teams.find((t) => t.id === entry.id);
      return defaultTeam?.rating !== customTeam?.rating;
    });

    expect(ratingDiffers).toBe(true);
  });

  it("surfaces custom-model rating deltas in monteCarloGameOutcomes sample results", () => {
    const boostedModel = customRatingModel({ upsetBonus: 0.2 });
    const result = monteCarloGameOutcomes(favorite, underdog, 1, {
      rng: sequenceRng([upsetRoll, ...scoreRolls]),
      tournamentState: tournamentStateWithHistory([favorite, underdog]),
      ratingModel: boostedModel,
    });

    expect(result.sampleResult.isUpset).toBe(true);
    expect(result.sampleResult.ratingDeltaB).toBeDefined();
    expect(result.sampleResult.ratingDeltaB!).toBeGreaterThan(0);
  });
});

describe("provisional and established K through bracket simulation", () => {
  it("boosts provisional teams more than established opponents in dynamic brackets", () => {
    const provisional = team("Provisional", 1500, "provisional");
    const established = team("Established", 1500, "established");
    const opponentA = team("OpponentA", 1500, "opponent-a");
    const opponentB = team("OpponentB", 1500, "opponent-b");

    const winRolls = [0.01, 0.5, 0.5];

    const provisionalResult = simulateBracket(
      createBracket([provisional, opponentA]),
      {
        dynamicRatings: true,
        rng: sequenceRng(winRolls),
        priorGamesPlayed: priorGamesMap([["provisional", 0]]),
      }
    );
    const establishedResult = simulateBracket(
      createBracket([established, opponentB]),
      {
        dynamicRatings: true,
        rng: sequenceRng(winRolls),
        priorGamesPlayed: priorGamesMap([["established", 40]]),
      }
    );

    const provisionalGain =
      provisionalResult.teams.find((entry) => entry.id === "provisional")!
        .rating - 1500;
    const establishedGain =
      establishedResult.teams.find((entry) => entry.id === "established")!
        .rating - 1500;

    expect(getChampion(provisionalResult).id).toBe("provisional");
    expect(getChampion(establishedResult).id).toBe("established");
    expect(provisionalGain).toBeGreaterThan(establishedGain);
  });

  it("honors priorGamesPlayed when seeding tournament state for simulateGame", () => {
    const provisional = team("Provisional", 1500);
    const opponent = team("Opponent", 1500);
    const state = tournamentStateWithHistory(
      [provisional, opponent],
      priorGamesMap([[provisional.id, 0], [opponent.id, 40]])
    );

    simulateGame(provisional, opponent, {
      rng: sequenceRng([0.01, 0.5, 0.5]),
      tournamentState: state,
    });

    expect(state.ratings.get(provisional.id)?.gamesPlayed).toBe(1);
    expect(provisional.rating - 1500).toBeGreaterThan(0);
  });
});

describe("monteCarloGameOutcomes confidence boundaries", () => {
  it("reports tight intervals near 100% and 0% win rates", () => {
    const favorite = team("Favorite", 2000);
    const underdog = team("Underdog", 1000);
    const upsetRoll = winProbabilityFor(favorite.rating, underdog.rating);

    const allFavoriteWins = monteCarloGameOutcomes(favorite, underdog, 250, {
      rng: constantRng(0.01),
    });
    expect(allFavoriteWins.winRateA).toBe(1);
    assertWilsonIntervalContract(
      allFavoriteWins.winRateConfidenceA,
      250,
      250
    );
    expect(allFavoriteWins.winRateConfidenceA.low).toBeGreaterThan(0.98);
    expect(allFavoriteWins.winRateConfidenceB.high).toBeLessThan(0.02);

    const allUnderdogWins = monteCarloGameOutcomes(favorite, underdog, 250, {
      rng: constantRng(upsetRoll),
    });
    expect(allUnderdogWins.winRateA).toBe(0);
    assertWilsonIntervalContract(
      allUnderdogWins.winRateConfidenceA,
      0,
      250
    );
    expect(allUnderdogWins.winRateConfidenceA.high).toBeLessThan(0.02);
    expect(allUnderdogWins.winRateConfidenceB.low).toBeGreaterThan(0.98);
  });

  it("keeps complementary Wilson intervals bracketing the two team win rates", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);
    const result = monteCarloGameOutcomes(teamA, teamB, 400, {
      rng: createSeededRng(8800),
    });

    assertWilsonIntervalContract(
      result.winRateConfidenceA,
      Math.round(result.winRateA * result.iterations),
      result.iterations
    );
    assertWilsonIntervalContract(
      result.winRateConfidenceB,
      Math.round(result.winRateB * result.iterations),
      result.iterations
    );
    expect(result.winRateConfidenceA.low + result.winRateConfidenceB.high).toBeGreaterThanOrEqual(
      0.95
    );
  });
});

describe("large-bracket RNG accounting", () => {
  it("consumes exactly three RNG draws per simulated game in a 32-team field", () => {
    const teams = ratedField(32);
    const { rng, callCount } = countingRng(createSeededRng(32000));

    simulateBracket(createBracket(teams), { rng });

    expect(callCount()).toBe(expectedRngCallsForTeamCount(32));
  });

  it("remains stable when the RNG sequence repeats mid-bracket", () => {
    const teams = ratedField(32);
    const shortCycle = sequenceRng([0.05, 0.5, 0.5]);

    const result = simulateBracket(createBracket(teams), { rng: shortCycle });
    assertBracketSimulationInvariants(result);
    expect(getChampion(result).name).toMatch(/^S\d+$/);
  });
});

describe("simulation property sweep", () => {
  it("preserves bracket invariants and rating conservation across many seeds", () => {
    const seeds = [1, 42, 999, 4242, 64000];
    const startingTotal = totalSeedRatingPoints(ratedField(16));

    forEachSimulationSeed(seeds, (seed) => {
      const result = simulateRatedField(16, {
        dynamicRatings: true,
        rng: createSeededRng(seed),
      });
      assertRatingTotalConserved(startingTotal, totalLiveRatingPoints(result), 1);
      expect(getChampion(result).name).not.toBe("BYE");
    });
  });

  it.each([17, 18, 31, 33])(
    "simulates %i-team padded fields without invariant violations",
    (teamCount) => {
      const result = simulateRatedField(teamCount, {
        rng: createSeededRng(teamCount * 100),
      });
      expect(getChampion(result).name).not.toBe("BYE");
    }
  );
});

describe("extreme rating inputs", () => {
  it("produces finite probabilities and valid scores for edge ratings", () => {
    const cases: Array<[number, number]> = [
      [0, 1500],
      [1500, 0],
      [5000, 1500],
      [1500, -200],
    ];

    for (const [ratingA, ratingB] of cases) {
      const result = simulateGame(team("A", ratingA), team("B", ratingB), {
        rng: sequenceRng([0.5, 0.5, 0.5]),
      });

      expect(Number.isFinite(result.winProbabilityA)).toBe(true);
      expect(result.scoreA).toBeGreaterThanOrEqual(55);
      expect(result.scoreB).toBeGreaterThanOrEqual(55);
      expect(result.margin).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(result.margin)).toBe(true);
    }
  });
});
