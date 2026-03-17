import { describe, expect, it } from "vitest";
import { createTournamentState, effectiveRating } from "../tournamentState.js";
import { cloneTeam, ratingForTeam } from "./helpers.js";
import { simulateGame } from "./gameSimulator.js";
import { sequenceRng, team } from "../testing/simulationFixtures.js";

describe("cloneTeam", () => {
  it("returns a shallow copy that does not share mutations with the original", () => {
    const original = team("Alpha", 1600, "alpha-id");
    const copy = cloneTeam(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);

    copy.rating = 1700;
    copy.name = "Renamed";

    expect(original.rating).toBe(1600);
    expect(original.name).toBe("Alpha");
  });

  it("preserves optional seed metadata on the copy", () => {
    const seeded = { ...team("OneSeed", 1500), seed: 1 };
    const copy = cloneTeam(seeded);

    expect(copy.seed).toBe(1);
    expect(copy.rating).toBe(1500);
  });
});

describe("ratingForTeam", () => {
  it("returns the team rating when no tournament state is provided", () => {
    const entry = team("Beta", 1525);
    expect(ratingForTeam(entry, {})).toBe(1525);
    expect(ratingForTeam(entry, { historicalWeight: 0.5 })).toBe(1525);
  });

  it("returns the live effective rating when tournament state tracks the team", () => {
    const entry = team("Gamma", 1500);
    const opponent = team("Opp", 1500);
    const state = createTournamentState([entry, opponent]);

    simulateGame(entry, opponent, {
      tournamentState: state,
      rng: sequenceRng([0.01, 0.5, 0.5]),
    });

    expect(entry.rating).not.toBe(1500);
    expect(ratingForTeam(entry, { tournamentState: state })).toBe(
      effectiveRating(entry, state)
    );
    expect(ratingForTeam(entry, { tournamentState: state })).toBe(entry.rating);
  });

  it("falls back to the team rating when state has no entry for the team", () => {
    const tracked = team("Tracked", 1500);
    const untracked = team("Untracked", 1400);
    const state = createTournamentState([tracked]);

    expect(ratingForTeam(untracked, { tournamentState: state })).toBe(1400);
  });
});
