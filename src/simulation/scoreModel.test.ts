import { describe, expect, it } from "vitest";
import {
  createScoreModel,
  defaultScoreModel,
  validateScoreModel,
} from "./scoreModel.js";
import {
  generateScores,
  simulateGame,
} from "../simulation/gameSimulator.js";
import type { Team } from "../types.js";
import { createSeededRng } from "../simulation/rng.js";

describe("defaultScoreModel", () => {
  it("matches the legacy production score constants", () => {
    expect(defaultScoreModel()).toEqual({
      baseWinnerScore: 68,
      winnerScoreSpread: 12,
      loserScoreFloor: 55,
      marginNoiseRange: 5,
    });
  });
});

describe("createScoreModel", () => {
  it("overrides selected fields while preserving defaults", () => {
    expect(createScoreModel({ baseWinnerScore: 72 })).toEqual({
      baseWinnerScore: 72,
      winnerScoreSpread: 12,
      loserScoreFloor: 55,
      marginNoiseRange: 5,
    });
  });
});

describe("validateScoreModel", () => {
  it("accepts the production defaults", () => {
    expect(() => validateScoreModel(defaultScoreModel())).not.toThrow();
  });

  it("rejects negative marginNoiseRange values", () => {
    expect(() =>
      createScoreModel({ marginNoiseRange: -1 })
    ).toThrow(/marginNoiseRange must be non-negative/);
  });

  it("rejects non-integer winnerScoreSpread values", () => {
    expect(() =>
      createScoreModel({ winnerScoreSpread: 6.5 })
    ).toThrow(/winnerScoreSpread must be a finite integer/);
  });

  it("rejects non-finite baseWinnerScore values", () => {
    expect(() =>
      createScoreModel({ baseWinnerScore: Number.NaN })
    ).toThrow(/baseWinnerScore must be a finite integer/);
  });
});

describe("simulateGame scoreModel validation", () => {
  function team(name: string, rating: number): Team {
    return { id: name.toLowerCase(), name, rating };
  }

  it("rejects invalid custom score models passed through options", () => {
    expect(() =>
      simulateGame(team("A", 1500), team("B", 1500), {
        scoreModel: {
          ...defaultScoreModel(),
          loserScoreFloor: -10,
        },
      })
    ).toThrow(/loserScoreFloor must be non-negative/);
  });
});

describe("generateScores", () => {
  it("produces deterministic scores for a fixed RNG sequence", () => {
    const rng = createSeededRng(99);
    const first = generateScores(1600, 1500, rng);
    const second = generateScores(1600, 1500, createSeededRng(99));
    expect(first).toEqual(second);
  });

  it("raises the winner baseline when baseWinnerScore is increased", () => {
    const rng = createSeededRng(7);
    const baseline = generateScores(1500, 1500, rng, defaultScoreModel());
    const boosted = generateScores(
      1500,
      1500,
      createSeededRng(7),
      createScoreModel({ baseWinnerScore: 80 })
    );
    expect(boosted.scoreWinner).toBeGreaterThan(baseline.scoreWinner);
    expect(boosted.scoreLoser).toBeGreaterThan(baseline.scoreLoser);
  });

  it("never lets the loser score fall below the configured floor", () => {
    const tightFloor = createScoreModel({
      baseWinnerScore: 60,
      winnerScoreSpread: 1,
      loserScoreFloor: 58,
      marginNoiseRange: 0,
    });
    const rng = createSeededRng(3);
    const { scoreWinner, scoreLoser } = generateScores(
      1700,
      1400,
      rng,
      tightFloor
    );
    expect(scoreLoser).toBeGreaterThanOrEqual(58);
    expect(scoreWinner).toBeGreaterThan(scoreLoser);
  });
});
