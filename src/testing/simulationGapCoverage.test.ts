import { describe, expect, it } from "vitest";
import { createBracket, getChampion, parseTeams } from "../bracket.js";
import { DEFAULT_HISTORICAL_WEIGHT } from "../probability/seedUpsets.js";
import { resolveWinProbabilityA } from "../probability/winProbability.js";
import { expectedScore } from "../ratings.js";
import {
  createScoreModel,
  createSeededRng,
  generateScores,
  monteCarloGameOutcomes,
  simulateBestOfSeries,
  simulateGame,
} from "../simulator.js";
import { createTournamentState } from "../tournamentState.js";
import type { Team } from "../types.js";
import {
  assertGamesPlayedAlignsWithScoredMatches,
  gamesPlayedFromState,
  simulateBracketFromRound,
  simulateBracketThroughRound,
} from "./simulationBoundary.js";
import {
  countingRng,
  sequenceRng,
  team,
  winProbabilityFor,
} from "./simulationFixtures.js";

describe("best-of-five series edge cases", () => {
  it("ends early when team A sweeps three games to nil", () => {
    const teamA = team("Alpha", 1650);
    const teamB = team("Beta", 1400);
    const { rng, callCount } = countingRng(
      sequenceRng([0.01, 0.5, 0.5, 0.01, 0.5, 0.5, 0.01, 0.5, 0.5])
    );

    const series = simulateBestOfSeries(teamA, teamB, 5, { rng });

    expect(series.games).toHaveLength(3);
    expect(series.winsA).toBe(3);
    expect(series.winsB).toBe(0);
    expect(series.winner.id).toBe(teamA.id);
    expect(callCount()).toBe(9);
  });

  it("plays all five games in a competitive three-to-two finish", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1590);
    const probabilityA = winProbabilityFor(teamA.rating, teamB.rating);

    const series = simulateBestOfSeries(teamA, teamB, 5, {
      rng: sequenceRng([
        0.01,
        0.5,
        0.5,
        probabilityA,
        0.5,
        0.5,
        0.01,
        0.5,
        0.5,
        probabilityA,
        0.5,
        0.5,
        0.01,
        0.5,
        0.5,
      ]),
    });

    expect(series.games).toHaveLength(5);
    expect(series.winsA).toBe(3);
    expect(series.winsB).toBe(2);
    expect(series.winner.id).toBe(teamA.id);
  });

  it("leaves returned team ratings unchanged when no tournament state is used", () => {
    const teamA = team("Alpha", 1600);
    const teamB = team("Beta", 1500);

    const series = simulateBestOfSeries(teamA, teamB, 5, {
      rng: sequenceRng([0.01, 0.5, 0.5, 0.01, 0.5, 0.5, 0.01, 0.5, 0.5]),
    });

    expect(series.teamA.rating).toBe(1600);
    expect(series.teamB.rating).toBe(1500);
    expect(teamA.rating).toBe(1600);
    expect(teamB.rating).toBe(1500);
  });
});

describe("historical weight boundary contracts", () => {
  const oneSeed: Team = { ...team("OneSeed", 1500), seed: 1 };
  const sixteenSeed: Team = { ...team("SixteenSeed", 1500), seed: 16 };

  it("disables seed blending when historicalWeight is zero, negative, or omitted", () => {
    const pureElo = expectedScore(oneSeed.rating, sixteenSeed.rating);
    const rolls = [0.25, 0.5, 0.5];

    const blended = simulateGame(oneSeed, sixteenSeed, {
      historicalWeight: DEFAULT_HISTORICAL_WEIGHT,
      rng: sequenceRng(rolls),
    });
    const omitted = simulateGame(oneSeed, sixteenSeed, {
      rng: sequenceRng(rolls),
    });
    const zeroWeight = simulateGame(oneSeed, sixteenSeed, {
      historicalWeight: 0,
      rng: sequenceRng(rolls),
    });
    const negativeWeight = simulateGame(oneSeed, sixteenSeed, {
      historicalWeight: -0.01,
      rng: sequenceRng(rolls),
    });

    expect(blended.winProbabilityA).not.toBeCloseTo(pureElo, 2);
    for (const result of [omitted, zeroWeight, negativeWeight]) {
      expect(result.winProbabilityA).toBeCloseTo(pureElo, 10);
    }
    expect(zeroWeight.winner.id).toBe(omitted.winner.id);
    expect(negativeWeight.winner.id).toBe(omitted.winner.id);
  });

  it("does not flag a lower-seed win as a rating upset when ratings are equal", () => {
    const blended = resolveWinProbabilityA(
      oneSeed,
      sixteenSeed,
      oneSeed.rating,
      sixteenSeed.rating,
      { seedA: 1, seedB: 16, historicalWeight: 1 }
    );

    const result = simulateGame(oneSeed, sixteenSeed, {
      seedA: 1,
      seedB: 16,
      historicalWeight: 1,
      rng: sequenceRng([blended, 0.5, 0.5]),
    });

    expect(result.winner.id).toBe(sixteenSeed.id);
    expect(result.isUpset).toBe(false);
    expect(result.winProbabilityA).toBeCloseTo(blended, 5);
  });
});

describe("series round context edge cases", () => {
  it("applies a stronger round K multiplier when round metadata targets the championship", () => {
    const teamA = team("Alpha", 1500);
    const teamB = team("Beta", 1500);
    const rolls = sequenceRng([0.01, 0.5, 0.5, 0.99, 0.5, 0.5, 0.01, 0.5, 0.5]);

    const earlyRoundState = createTournamentState([teamA, teamB]);
    const earlySeries = simulateBestOfSeries(teamA, teamB, 3, {
      tournamentState: earlyRoundState,
      round: 0,
      totalRounds: 4,
      rng: rolls,
    });

    const lateRoundState = createTournamentState([teamA, teamB]);
    const lateSeries = simulateBestOfSeries(teamA, teamB, 3, {
      tournamentState: lateRoundState,
      round: 3,
      totalRounds: 4,
      rng: rolls,
    });

    const earlyDelta = Math.abs(earlySeries.games[0].ratingDeltaA ?? 0);
    const lateDelta = Math.abs(lateSeries.games[0].ratingDeltaA ?? 0);

    expect(lateDelta).toBeGreaterThan(earlyDelta);
    expect(earlySeries.games[0].winProbabilityA).toBeCloseTo(
      lateSeries.games[0].winProbabilityA,
      5
    );
  });
});

describe("generateScores floor binding with zero spread", () => {
  it("preserves margin when the loser floor binds and winnerScoreSpread is zero", () => {
    const model = createScoreModel({
      baseWinnerScore: 68,
      winnerScoreSpread: 0,
      loserScoreFloor: 55,
      marginNoiseRange: 0,
    });
    const favoriteRating = 2100;
    const underdogRating = 1100;

    const { scoreWinner, scoreLoser } = generateScores(
      favoriteRating,
      underdogRating,
      constantSequenceRng(),
      model
    );

    expect(scoreLoser).toBe(55);
    expect(scoreWinner).toBeGreaterThan(scoreLoser);
    expect(scoreWinner - scoreLoser).toBeGreaterThanOrEqual(1);
  });
});

describe("monteCarloGameOutcomes with custom score models", () => {
  it("aggregates scores and margins using the provided score model", () => {
    const teamA = team("Alpha", 1650);
    const teamB = team("Beta", 1500);
    const model = createScoreModel({
      baseWinnerScore: 72,
      winnerScoreSpread: 0,
      loserScoreFloor: 60,
      marginNoiseRange: 0,
    });
    const rng = createSeededRng(4242);
    const iterations = 200;

    const monteCarlo = monteCarloGameOutcomes(teamA, teamB, iterations, {
      scoreModel: model,
      rng,
    });

    const manual = computeGameOutcomeAggregatesWithScoreModel(
      teamA,
      teamB,
      iterations,
      createSeededRng(4242),
      model
    );

    expect(monteCarlo.avgScoreA).toBeCloseTo(manual.avgScoreA, 10);
    expect(monteCarlo.avgScoreB).toBeCloseTo(manual.avgScoreB, 10);
    expect(monteCarlo.avgMargin).toBeCloseTo(manual.avgMargin, 10);
    expect(monteCarlo.marginStdDev).toBeCloseTo(manual.marginStdDev, 10);
    expect(Math.min(monteCarlo.avgScoreA, monteCarlo.avgScoreB)).toBeGreaterThanOrEqual(
      60
    );
  });
});

describe("partial bracket resume with games-played bookkeeping", () => {
  it("aligns gamesPlayed counters when priorGamesPlayed seeds resumed dynamic state", () => {
    const teams = parseTeams(["A", "B", "C", "D", "E", "F", "G", "H"]).map(
      (entry, index) => ({
        ...entry,
        rating: 1700 - index * 25,
      })
    );
    const bracket = createBracket(teams);

    const partial = simulateBracketThroughRound(bracket, 0, {
      dynamicRatings: true,
      rng: createSeededRng(5150),
    });

    const priorGames = new Map<string, number>();
    for (const match of partial.matches) {
      if (match.round !== 0 || match.scoreA === undefined) {
        continue;
      }
      for (const participant of [match.teamA, match.teamB]) {
        if (!participant) {
          continue;
        }
        priorGames.set(
          participant.id,
          (priorGames.get(participant.id) ?? 0) + 1
        );
      }
    }

    let captured: ReturnType<typeof createTournamentState> | undefined;
    const finished = simulateBracketFromRound(partial, 1, {
      dynamicRatings: true,
      priorGamesPlayed: priorGames,
      rng: createSeededRng(6161),
      onTournamentState: (state) => {
        captured = state;
      },
    });

    expect(captured).toBeDefined();
    expect(getChampion(finished).name).not.toBe("BYE");
    assertGamesPlayedAlignsWithScoredMatches(finished, captured!);

    for (const [teamId, priorCount] of priorGames) {
      expect(gamesPlayedFromState(captured!, teamId)).toBeGreaterThanOrEqual(
        priorCount
      );
    }
  });
});

function constantSequenceRng(): () => number {
  return () => 0;
}

function computeGameOutcomeAggregatesWithScoreModel(
  teamA: Team,
  teamB: Team,
  iterations: number,
  rng: () => number,
  scoreModel: ReturnType<typeof createScoreModel>
) {
  let winsA = 0;
  let upsets = 0;
  let marginTotal = 0;
  let scoreATotal = 0;
  let scoreBTotal = 0;
  const margins: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const result = simulateGame({ ...teamA }, { ...teamB }, { rng, scoreModel });
    if (result.winner.id === teamA.id) {
      winsA++;
    }
    if (result.isUpset) {
      upsets++;
    }
    marginTotal += result.margin;
    margins.push(result.margin);
    scoreATotal += result.scoreA;
    scoreBTotal += result.scoreB;
  }

  const avgMargin = marginTotal / iterations;
  const variance =
    margins.reduce((sum, margin) => sum + (margin - avgMargin) ** 2, 0) /
    iterations;

  return {
    winRateA: winsA / iterations,
    winRateB: 1 - winsA / iterations,
    upsetRate: upsets / iterations,
    avgMargin,
    marginStdDev: Math.sqrt(variance),
    avgScoreA: scoreATotal / iterations,
    avgScoreB: scoreBTotal / iterations,
  };
}
