import { describe, expect, it } from "vitest";
import {
  actualScoreFromGame,
  computeActualScores,
  contextualKFactor,
  roundKMultiplier,
  updateTeamRatingsWithContext,
} from "./eloUpdates.js";
import { createTeamRating } from "./ratings.js";

function gameContext(
  overrides: Partial<{
    round: number;
    totalRounds: number;
    margin: number;
    isUpset: boolean;
  }> = {}
) {
  return {
    round: 0,
    totalRounds: 3,
    margin: 10,
    isUpset: false,
    ...overrides,
  };
}

describe("actualScoreFromGame", () => {
  it("treats a blowout as fully decisive", () => {
    expect(actualScoreFromGame(true, 20)).toBe(1);
    expect(actualScoreFromGame(false, 20)).toBe(0);
  });

  it("gives partial credit on close wins", () => {
    expect(actualScoreFromGame(true, 2)).toBeCloseTo(0.55);
    expect(actualScoreFromGame(false, 2)).toBeCloseTo(0.45);
  });

  it("preserves even-matchup decisiveness when ratings are provided", () => {
    const withRatings = actualScoreFromGame(true, 10, 20, 1500, 1500);
    const withoutRatings = actualScoreFromGame(true, 10);
    expect(withRatings).toBeCloseTo(withoutRatings);
  });

  it("counts a favorite win as less decisive than the same margin between equals", () => {
    const evenMatch = actualScoreFromGame(true, 15, 20, 1500, 1500);
    const favoriteWin = actualScoreFromGame(true, 15, 20, 1700, 1500);
    expect(favoriteWin).toBeLessThan(evenMatch);
  });

  it("counts an underdog win as more decisive than a favorite win at the same margin", () => {
    const favoriteWin = actualScoreFromGame(true, 10, 20, 1700, 1500);
    const upsetWin = actualScoreFromGame(true, 10, 20, 1500, 1700);
    expect(upsetWin).toBeGreaterThan(favoriteWin);
  });
});

describe("roundKMultiplier", () => {
  it("weights the championship round more heavily than round one", () => {
    expect(roundKMultiplier(2, 3)).toBeGreaterThan(roundKMultiplier(0, 3));
  });

  it("returns 1 for single-round brackets", () => {
    expect(roundKMultiplier(0, 1)).toBe(1);
  });
});

describe("contextualKFactor", () => {
  it("uses a higher K in later rounds for the same team", () => {
    const team = createTeamRating(1500);
    const early = contextualKFactor(team, gameContext({ round: 0, totalRounds: 4 }));
    const late = contextualKFactor(team, gameContext({ round: 3, totalRounds: 4 }));
    expect(late).toBeGreaterThan(early);
  });
});

describe("computeActualScores", () => {
  it("awards more credit for a 20-point win than a 2-point win", () => {
    const blowout = computeActualScores(90, 70, gameContext({ margin: 20 }), 1500, 1500);
    const close = computeActualScores(72, 70, gameContext({ margin: 2 }), 1500, 1500);
    expect(blowout[0]).toBeGreaterThan(close[0]);
    expect(blowout[1]).toBeLessThan(close[1]);
  });

  it("transfers less rating when a heavy favorite wins by the same margin", () => {
    const even = computeActualScores(85, 70, gameContext({ margin: 15 }), 1500, 1500);
    const favorite = computeActualScores(85, 70, gameContext({ margin: 15 }), 1700, 1500);
    expect(favorite[0]).toBeLessThan(even[0]);
    expect(favorite[1]).toBeGreaterThan(even[1]);
  });

  it("boosts the underdog on an upset", () => {
    const expected = computeActualScores(
      80,
      70,
      gameContext({ margin: 10, isUpset: false }),
      1700,
      1500
    );
    const upset = computeActualScores(
      80,
      70,
      gameContext({ margin: 10, isUpset: true }),
      1700,
      1500
    );
    expect(upset[0]).toBeGreaterThan(expected[0]);
    expect(upset[1]).toBeLessThan(expected[1]);
  });
});

describe("updateTeamRatingsWithContext", () => {
  it("transfers more rating on a blowout than a nail-biter", () => {
    const teamA = createTeamRating(1500);
    const teamB = createTeamRating(1500);
    const context = gameContext({ totalRounds: 1, round: 0 });

    const [, blowoutB] = updateTeamRatingsWithContext(
      teamA,
      teamB,
      95,
      70,
      { ...context, margin: 25 }
    );
    const closeA = createTeamRating(1500);
    const closeB = createTeamRating(1500);
    const [closeWinner] = updateTeamRatingsWithContext(
      closeA,
      closeB,
      72,
      70,
      { ...context, margin: 2 }
    );

    expect(1500 - blowoutB.rating).toBeGreaterThan(closeWinner.rating - 1500);
  });

  it("uses a higher K in the final than in round one", () => {
    const roundOneA = createTeamRating(1500);
    const roundOneB = createTeamRating(1500);
    const [roundOneWinner] = updateTeamRatingsWithContext(
      roundOneA,
      roundOneB,
      80,
      70,
      gameContext({ round: 0, totalRounds: 3, margin: 10 })
    );

    const finalA = createTeamRating(1500);
    const finalB = createTeamRating(1500);
    const [finalWinner] = updateTeamRatingsWithContext(
      finalA,
      finalB,
      80,
      70,
      gameContext({ round: 2, totalRounds: 3, margin: 10 })
    );

    expect(finalWinner.rating - 1500).toBeGreaterThan(roundOneWinner.rating - 1500);
  });

  it("preserves approximate zero-sum rating transfer", () => {
    const teamA = createTeamRating(1600);
    const teamB = createTeamRating(1400);
    const [newA, newB] = updateTeamRatingsWithContext(
      teamA,
      teamB,
      85,
      72,
      gameContext({ margin: 13, isUpset: true })
    );

    const totalDelta = newA.rating - teamA.rating + (newB.rating - teamB.rating);
    expect(Math.abs(totalDelta)).toBeLessThanOrEqual(1);
  });
});
