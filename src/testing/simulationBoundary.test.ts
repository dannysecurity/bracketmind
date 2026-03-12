import { describe, expect, it } from "vitest";
import {
  createBracket,
  getChampion,
  parseTeams,
  simulateBracket,
} from "../bracket.js";
import { matchIndex } from "../bracket/layout.js";
import { defaultRatingModel } from "../ratingsModel.js";
import {
  createSeededRng,
  monteCarloChampionshipRates,
  resolveSimulationRoundContext,
  wilsonScoreInterval,
} from "../simulator.js";
import {
  createTournamentState,
  recordGameResult,
} from "../tournamentState.js";
import {
  assertWilsonIntervalContract,
  customRatingModel,
} from "./simulationContract.js";
import {
  STRESS_FIELD_SIZES,
  assertGamesPlayedAlignsWithScoredMatches,
  bracketRoundsForTeamCount,
  clearMatchSide,
  expectedChampionGameCount,
  firstRoundLoser,
  gamesPlayedFromState,
  scoredGamesForTeam,
  simulateBracketFromRound,
  simulateBracketThroughRound,
} from "./simulationBoundary.js";
import {
  assertBracketSimulationInvariants,
  countingRng,
  expectedRngCallsForTeamCount,
  priorGamesMap,
  ratedField,
  sequenceRng,
  team,
} from "./simulationFixtures.js";
import type { TournamentState } from "../types.js";

function captureState(
  onCapture: (state: TournamentState) => void
): { onTournamentState: (state: TournamentState) => void } {
  return { onTournamentState: onCapture };
}

describe("wilsonScoreInterval boundary inputs", () => {
  it("clamps successes above trials and still returns a valid interval", () => {
    const interval = wilsonScoreInterval(150, 100);
    assertWilsonIntervalContract(interval, 100, 100);
    expect(interval.low).toBeGreaterThanOrEqual(0);
    expect(interval.high).toBeLessThanOrEqual(1);
    expect(interval.high).toBeCloseTo(1, 5);
  });

  it("treats negative successes as zero successes", () => {
    const interval = wilsonScoreInterval(-25, 200);
    assertWilsonIntervalContract(interval, 0, 200);
    expect(interval.low).toBe(0);
    expect(interval.high).toBeLessThan(0.05);
  });

  it("collapses to the point estimate when z is zero", () => {
    const interval = wilsonScoreInterval(30, 100, 0);
    expect(interval.low).toBeCloseTo(0.3, 10);
    expect(interval.high).toBeCloseTo(0.3, 10);
  });

  it("collapses to the point estimate when z is negative", () => {
    const interval = wilsonScoreInterval(7, 10, -1.96);
    expect(interval.low).toBeCloseTo(0.7, 10);
    expect(interval.high).toBeCloseTo(0.7, 10);
  });
});

describe("resolveSimulationRoundContext boundary inputs", () => {
  it("preserves negative round values when total rounds are defaulted", () => {
    expect(resolveSimulationRoundContext(-1)).toEqual({
      round: -1,
      totalRounds: 4,
    });
  });

  it("derives a negative championship round when totalRounds is zero", () => {
    expect(resolveSimulationRoundContext(undefined, 0)).toEqual({
      round: -1,
      totalRounds: 0,
    });
  });

  it("treats a single-round bracket as all-championship context", () => {
    expect(resolveSimulationRoundContext(undefined, 1)).toEqual({
      round: 0,
      totalRounds: 1,
    });
  });

  it("passes through round indices that exceed totalRounds without clamping", () => {
    expect(resolveSimulationRoundContext(5, 4)).toEqual({
      round: 5,
      totalRounds: 4,
    });
  });
});

describe("large and padded field simulation boundaries", () => {
  it.each(STRESS_FIELD_SIZES.map((count) => [count]))(
    "simulates a %i-team field with valid scores and RNG accounting",
    (teamCount) => {
      const teams = ratedField(teamCount, 1900, 7);
      const bracket = createBracket(teams);
      const { rng, callCount } = countingRng(createSeededRng(teamCount * 13));

      const result = simulateBracket(bracket, { rng });

      assertBracketSimulationInvariants(result);
      expect(bracket.rounds).toBe(bracketRoundsForTeamCount(teamCount));
      expect(callCount()).toBe(expectedRngCallsForTeamCount(teamCount));
      expect(getChampion(result).name).not.toBe("BYE");
    }
  );
});

describe("priorGamesPlayed on multi-round brackets", () => {
  it("applies larger rating swings to provisional teams across a 16-team bracket", () => {
    const field = ratedField(16, 1650, 20);
    const provisionalId = field[0].id;
    const establishedId = field[1].id;
    const rng = createSeededRng(16016);

    const provisionalRun = simulateBracket(createBracket(field), {
      dynamicRatings: true,
      rng,
      priorGamesPlayed: priorGamesMap([[provisionalId, 0]]),
    });
    const establishedRun = simulateBracket(createBracket(field), {
      dynamicRatings: true,
      rng: createSeededRng(16016),
      priorGamesPlayed: priorGamesMap([[establishedId, 40]]),
    });

    const provisionalDelta =
      provisionalRun.teams.find((entry) => entry.id === provisionalId)!.rating -
      field[0].rating;
    const establishedDelta =
      establishedRun.teams.find((entry) => entry.id === establishedId)!.rating -
      field[1].rating;

    expect(Math.abs(provisionalDelta)).toBeGreaterThan(Math.abs(establishedDelta));
  });

  it("combines priorGamesPlayed with a custom ratingModel on an eight-team bracket", () => {
    const teams = ratedField(8, 1700, 30);
    const targetId = teams[2].id;
    const customModel = customRatingModel({ baseKFactor: 48, upsetBonus: 0.15 });
    const defaultModel = defaultRatingModel();

    const defaultRun = simulateBracket(createBracket(teams), {
      dynamicRatings: true,
      rng: createSeededRng(808),
      priorGamesPlayed: priorGamesMap([[targetId, 2]]),
    });
    const customRun = simulateBracket(createBracket(teams), {
      dynamicRatings: true,
      rng: createSeededRng(808),
      priorGamesPlayed: priorGamesMap([[targetId, 2]]),
      ratingModel: customModel,
    });

    const defaultRating = defaultRun.teams.find((entry) => entry.id === targetId)!
      .rating;
    const customRating = customRun.teams.find((entry) => entry.id === targetId)!
      .rating;

    expect(customRating).not.toBe(defaultRating);
    expect(customModel.baseKFactor).toBeGreaterThan(defaultModel.baseKFactor);
  });

  it("silently ignores priorGamesPlayed entries for unknown team IDs", () => {
    const teams = ratedField(4, 1600, 50);
    let captured: TournamentState | undefined;

    simulateBracket(createBracket(teams), {
      dynamicRatings: true,
      rng: createSeededRng(404),
      priorGamesPlayed: priorGamesMap([["missing-team", 99]]),
      ...captureState((state) => {
        captured = state;
      }),
    });

    expect(captured).toBeDefined();
    expect(captured!.ratings.has("missing-team")).toBe(false);
    for (const entry of teams) {
      expect(gamesPlayedFromState(captured!, entry.id)).toBeGreaterThan(0);
    }
  });
});

describe("games-played bookkeeping through full brackets", () => {
  it("tracks champion and first-round loser game counts on an eight-team bracket", () => {
    const teams = ratedField(8, 1700, 25);
    let captured: TournamentState | undefined;

    const result = simulateBracket(createBracket(teams), {
      dynamicRatings: true,
      rng: createSeededRng(888),
      ...captureState((state) => {
        captured = state;
      }),
    });

    const champion = getChampion(result);
    const loser = firstRoundLoser(result);
    expect(captured).toBeDefined();
    expect(loser).toBeDefined();

    expect(gamesPlayedFromState(captured!, champion.id)).toBe(
      expectedChampionGameCount(teams.length)
    );
    expect(gamesPlayedFromState(captured!, loser!.id)).toBe(1);
    assertGamesPlayedAlignsWithScoredMatches(result, captured!);
  });

  it("keeps BYE recipients at zero games-played until their first real matchup", () => {
    const teams = parseTeams(["S1", "S2", "S3"]).map((entry, index) => ({
      ...entry,
      rating: 1700 - index * 60,
    }));
    let captured: TournamentState | undefined;

    const result = simulateBracket(createBracket(teams), {
      dynamicRatings: true,
      rng: createSeededRng(303),
      ...captureState((state) => {
        captured = state;
      }),
    });

    const topSeed = [...teams].sort((a, b) => b.rating - a.rating)[0];
    expect(gamesPlayedFromState(captured!, topSeed.id)).toBe(
      scoredGamesForTeam(result, topSeed.id)
    );
    expect(scoredGamesForTeam(result, topSeed.id)).toBeGreaterThan(0);
    assertGamesPlayedAlignsWithScoredMatches(result, captured!);
  });
});

describe("simulateBracketThroughRound / simulateBracketFromRound round boundaries", () => {
  it("simulates no rounds when throughRound is negative", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D"]));
    const partial = simulateBracketThroughRound(bracket, -1);

    const scored = partial.matches.filter((match) => match.scoreA !== undefined);
    expect(scored).toHaveLength(0);
    expect(() => getChampion(partial)).toThrow(/not been simulated/);
  });

  it("clamps throughRound above the final round to a full run", () => {
    const teams = parseTeams(["A", "B", "C", "D"]);
    const bracket = createBracket(teams);
    const rolls = sequenceRng([0.01, 0.5, 0.5, 0.99, 0.5, 0.5, 0.01, 0.5, 0.5]);

    const clamped = simulateBracketThroughRound(bracket, 999, { rng: rolls });
    const full = simulateBracket(structuredClone(bracket), { rng: rolls });

    expect(clamped.matches.map((m) => m.winner?.id)).toEqual(
      full.matches.map((m) => m.winner?.id)
    );
    expect(getChampion(clamped)?.id).toBe(getChampion(full)?.id);
  });

  it("is a no-op when fromRound equals the bracket round count", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D"]));
    const partial = simulateBracketThroughRound(bracket, 0, {
      rng: sequenceRng([0.01, 0.5, 0.5, 0.99, 0.5, 0.5]),
    });

    const unchanged = simulateBracketFromRound(partial, bracket.rounds);

    expect(unchanged.matches.map((m) => m.winner?.id)).toEqual(
      partial.matches.map((m) => m.winner?.id)
    );
    expect(() => getChampion(unchanged)).toThrow(/not been simulated/);
  });
});

describe("simulateBracket corruption and replay boundaries", () => {
  it("throws when a semifinal slot is missing a participant", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D", "E", "F", "G", "H"]));
    const partial = simulateBracketThroughRound(bracket, 0, {
      rng: sequenceRng([0.01, 0.5, 0.5, 0.99, 0.5, 0.5, 0.01, 0.5, 0.5, 0.99, 0.5, 0.5]),
    });
    clearMatchSide(partial, 1, 0, "teamB");

    expect(() =>
      simulateBracketFromRound(partial, 1, {
        rng: sequenceRng([0.01, 0.5, 0.5, 0.01, 0.5, 0.5]),
      })
    ).toThrow(/Incomplete match at round 1/);
  });

  it("throws when the championship match is missing both participants", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D"]));
    const partial = simulateBracketThroughRound(bracket, 1, {
      rng: sequenceRng([0.01, 0.5, 0.5, 0.99, 0.5, 0.5, 0.01, 0.5, 0.5]),
    });
    const finalRound = bracket.rounds - 1;
    clearMatchSide(partial, finalRound, 0, "both");

    expect(() =>
      simulateBracketFromRound(partial, finalRound, {
        rng: sequenceRng([0.01, 0.5, 0.5]),
      })
    ).toThrow(new RegExp(`Incomplete match at round ${finalRound}`));
  });

  it("overwrites pre-filled scores when a bracket is simulated again", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D"]));
    const first = simulateBracket(bracket, {
      rng: sequenceRng([0.01, 0.5, 0.5, 0.99, 0.5, 0.5, 0.01, 0.5, 0.5]),
    });

    const replay = simulateBracket(structuredClone(first), {
      rng: sequenceRng([0.99, 0.5, 0.5, 0.01, 0.5, 0.5, 0.99, 0.5, 0.5]),
    });

    const changedScores = replay.matches.some((match, index) => {
      if (match.scoreA === undefined) {
        return false;
      }
      return (
        match.scoreA !== first.matches[index].scoreA ||
        match.scoreB !== first.matches[index].scoreB
      );
    });

    expect(changedScores).toBe(true);
    assertBracketSimulationInvariants(replay);
  });

  it("throws when getChampion is called on a partially simulated bracket", () => {
    const bracket = createBracket(parseTeams(["A", "B", "C", "D"]));
    const partial = simulateBracket(structuredClone(bracket), {
      rng: sequenceRng([0.01, 0.5, 0.5, 0.99, 0.5, 0.5]),
    });

    const finalIdx = matchIndex(bracket.rounds - 1, 0, bracket.rounds);
    partial.matches[finalIdx].winner = undefined;
    partial.matches[finalIdx].scoreA = undefined;
    partial.matches[finalIdx].scoreB = undefined;

    expect(() => getChampion(partial)).toThrow(/not been simulated/);
  });
});

describe("ratingModel without dynamicRatings", () => {
  it("produces identical outcomes whether or not a custom ratingModel is passed", () => {
    const teams = ratedField(8, 1680, 22);
    const rolls = sequenceRng([0.12, 0.4, 0.6, 0.88, 0.2, 0.7]);

    const withoutModel = simulateBracket(createBracket(teams), { rng: rolls });
    const withInertModel = simulateBracket(createBracket(teams), {
      rng: sequenceRng([0.12, 0.4, 0.6, 0.88, 0.2, 0.7]),
      ratingModel: customRatingModel({ baseKFactor: 64 }),
    });

    for (let i = 0; i < withoutModel.matches.length; i++) {
      expect(withInertModel.matches[i].winner?.id).toBe(
        withoutModel.matches[i].winner?.id
      );
      expect(withInertModel.matches[i].scoreA).toBe(withoutModel.matches[i].scoreA);
      expect(withInertModel.matches[i].scoreB).toBe(withoutModel.matches[i].scoreB);
    }
  });
});

describe("tournamentState BYE argument order", () => {
  it("returns zero deltas when the BYE placeholder is team A", () => {
    const real = team("Real", 1520);
    const bye = team("BYE", 0, "bye-a");
    const state = createTournamentState([real]);

    const deltas = recordGameResult(state, bye, real, 70, 62);
    expect(deltas).toEqual({ ratingDeltaA: 0, ratingDeltaB: 0 });
    expect(real.rating).toBe(1520);
    expect(state.ratings.has("bye-a")).toBe(false);
  });
});

describe("monteCarloChampionshipRates with dynamic rating history", () => {
  it("threads priorGamesPlayed through repeated bracket simulations", () => {
    const teams = ratedField(4, 1580, 15);
    const volatileId = teams[1].id;
    let endRatingMismatchCount = 0;

    for (let seed = 1; seed <= 40; seed++) {
      const provisional = simulateBracket(createBracket(teams), {
        dynamicRatings: true,
        rng: createSeededRng(seed),
        priorGamesPlayed: priorGamesMap([[volatileId, 0]]),
      });
      const established = simulateBracket(createBracket(teams), {
        dynamicRatings: true,
        rng: createSeededRng(seed),
        priorGamesPlayed: priorGamesMap([[volatileId, 35]]),
      });

      const provisionalRating = provisional.teams.find(
        (entry) => entry.id === volatileId
      )!.rating;
      const establishedRating = established.teams.find(
        (entry) => entry.id === volatileId
      )!.rating;

      if (provisionalRating !== establishedRating) {
        endRatingMismatchCount += 1;
      }
    }

    expect(endRatingMismatchCount).toBeGreaterThan(0);

    let iteration = 0;
    const rates = monteCarloChampionshipRates(teams, 20, (field) => {
      iteration += 1;
      return getChampion(
        simulateBracket(createBracket(field), {
          dynamicRatings: true,
          rng: createSeededRng(iteration * 17),
          priorGamesPlayed: priorGamesMap([[volatileId, 3]]),
        })
      );
    });

    const totalRate = [...rates.values()].reduce((sum, rate) => sum + rate, 0);
    expect(totalRate).toBeCloseTo(1, 10);
    expect(rates.size).toBe(teams.length);
  });
});
