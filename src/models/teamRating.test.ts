import { describe, expect, it } from "vitest";
import {
  applyRatingUpdate,
  confidenceKMultiplier,
  createTeamRating,
  isProvisionalTeamRating,
  ratingDeviationAfterGames,
  updateFormMomentum,
  withPriorGamesPlayed,
} from "./teamRating.js";
import { defaultRatingModel } from "../ratingsModel.js";

describe("createTeamRating", () => {
  it("starts with default rating, zero games, and initial deviation", () => {
    const model = defaultRatingModel();
    const team = createTeamRating(undefined, {}, model);

    expect(team).toEqual({
      rating: 1500,
      gamesPlayed: 0,
      ratingDeviation: model.initialRatingDeviation,
      peakRating: 1500,
      lastDelta: 0,
      formMomentum: 0,
    });
  });

  it("derives deviation from prior games played", () => {
    const team = createTeamRating(1600, { gamesPlayed: 10 });

    expect(team.rating).toBe(1600);
    expect(team.gamesPlayed).toBe(10);
    expect(team.ratingDeviation).toBe(ratingDeviationAfterGames(10));
  });
});

describe("ratingDeviationAfterGames", () => {
  it("decays toward the minimum as games accumulate", () => {
    const model = defaultRatingModel();
    const early = ratingDeviationAfterGames(0, model);
    const mid = ratingDeviationAfterGames(10, model);
    const late = ratingDeviationAfterGames(40, model);

    expect(early).toBe(model.initialRatingDeviation);
    expect(mid).toBeLessThan(early);
    expect(late).toBe(model.minRatingDeviation);
  });
});

describe("confidenceKMultiplier", () => {
  it("returns full weight for uncertain teams and dampens established ones", () => {
    const model = defaultRatingModel();
    const uncertain = confidenceKMultiplier(model.initialRatingDeviation, model);
    const established = confidenceKMultiplier(model.minRatingDeviation, model);

    expect(uncertain).toBeCloseTo(model.rdKMin + model.rdKRange);
    expect(established).toBeCloseTo(model.rdKMin);
    expect(uncertain).toBeGreaterThan(established);
  });
});

describe("updateFormMomentum", () => {
  it("blends performance surprise into a bounded momentum score", () => {
    const team = createTeamRating(1500);
    const hot = updateFormMomentum(team, 0.8);
    const cold = updateFormMomentum(team, -0.8);

    expect(hot).toBeCloseTo(0.32);
    expect(cold).toBeCloseTo(-0.32);
    expect(updateFormMomentum({ ...team, formMomentum: hot }, 1)).toBeLessThanOrEqual(1);
  });
});

describe("applyRatingUpdate", () => {
  it("tracks peak rating and last delta after a win", () => {
    const team = createTeamRating(1500);
    const updated = applyRatingUpdate(team, 1520);

    expect(updated.rating).toBe(1520);
    expect(updated.peakRating).toBe(1520);
    expect(updated.lastDelta).toBe(20);
    expect(updated.gamesPlayed).toBe(1);
    expect(updated.ratingDeviation).toBeLessThan(team.ratingDeviation);
  });

  it("preserves peak rating when rating drops", () => {
    const team = createTeamRating(1600);
    const peaked = applyRatingUpdate(team, 1650);
    const dipped = applyRatingUpdate(peaked, 1580);

    expect(dipped.peakRating).toBe(1650);
    expect(dipped.lastDelta).toBe(-70);
  });

  it("tracks form momentum when performance surprise is provided", () => {
    const team = createTeamRating(1500);
    const updated = applyRatingUpdate(team, 1520, defaultRatingModel(), {
      performanceSurprise: 0.5,
    });

    expect(updated.formMomentum).toBeCloseTo(0.2);
  });
});

describe("isProvisionalTeamRating", () => {
  it("flags teams below the provisional threshold", () => {
    const provisional = createTeamRating(1500, { gamesPlayed: 2 });
    const established = createTeamRating(1500, { gamesPlayed: 15 });

    expect(isProvisionalTeamRating(provisional)).toBe(true);
    expect(isProvisionalTeamRating(established)).toBe(false);
  });
});

describe("withPriorGamesPlayed", () => {
  it("recomputes deviation without changing the current rating", () => {
    const team = createTeamRating(1550);
    const seasoned = withPriorGamesPlayed(team, 25);

    expect(seasoned.rating).toBe(1550);
    expect(seasoned.gamesPlayed).toBe(25);
    expect(seasoned.ratingDeviation).toBe(ratingDeviationAfterGames(25));
  });
});

describe("confidence-weighted Elo integration", () => {
  it("assigns lower deviation to teams with extensive prior history", () => {
    const uncertain = createTeamRating(1500);
    const veteran = createTeamRating(1500, { gamesPlayed: 40 });

    expect(veteran.ratingDeviation).toBeLessThan(uncertain.ratingDeviation);
    expect(veteran.ratingDeviation).toBe(defaultRatingModel().minRatingDeviation);
  });
});
