import { describe, expect, it } from "vitest";
import {
  createTournamentState,
  effectiveRating,
  recordGameResult,
} from "./tournamentState.js";
import type { Team } from "./types.js";

function team(name: string, rating: number): Team {
  return { id: name.toLowerCase(), name, rating };
}

describe("createTournamentState", () => {
  it("tracks every non-BYE team", () => {
    const state = createTournamentState([
      team("Alpha", 1600),
      team("Beta", 1500),
      { id: "bye-3", name: "BYE", rating: 0 },
    ]);

    expect(state.ratings.size).toBe(2);
    expect(state.ratings.get("alpha")?.rating).toBe(1600);
    expect(state.ratings.get("beta")?.gamesPlayed).toBe(0);
  });
});

describe("effectiveRating", () => {
  it("returns the live tournament rating when tracked", () => {
    const alpha = team("Alpha", 1500);
    const beta = team("Beta", 1500);
    const state = createTournamentState([alpha, beta]);

    recordGameResult(state, alpha, beta, 80, 70);

    expect(effectiveRating(alpha, state)).toBe(alpha.rating);
    expect(alpha.rating).toBeGreaterThan(1500);
  });
});

describe("recordGameResult", () => {
  it("transfers rating points to the winner and increments games played", () => {
    const teamA = team("TeamA", 1500);
    const teamB = team("TeamB", 1500);
    const state = createTournamentState([teamA, teamB]);

    const { ratingDeltaA, ratingDeltaB } = recordGameResult(
      state,
      teamA,
      teamB,
      80,
      70
    );

    expect(ratingDeltaA).toBeGreaterThan(0);
    expect(ratingDeltaB).toBeLessThan(0);
    expect(state.ratings.get("teama")?.gamesPlayed).toBe(1);
    expect(state.ratings.get("teamb")?.gamesPlayed).toBe(1);
    expect(teamA.rating).toBe(state.ratings.get("teama")?.rating);
    expect(teamB.rating).toBe(state.ratings.get("teamb")?.rating);
  });

  it("boosts provisional teams more than established opponents", () => {
    const provisionalA = team("Provisional", 1500);
    const opponentA = team("OpponentA", 1500);
    const provisionalState = createTournamentState([provisionalA, opponentA]);
    recordGameResult(provisionalState, provisionalA, opponentA, 90, 60);
    const provisionalGain = provisionalA.rating - 1500;

    const established = team("Established", 1500);
    const opponentB = team("OpponentB", 1500);
    const establishedState = createTournamentState([established, opponentB]);
    establishedState.ratings.set("established", {
      rating: 1500,
      gamesPlayed: 40,
    });
    recordGameResult(establishedState, established, opponentB, 90, 60);
    const establishedGain = established.rating - 1500;

    expect(provisionalGain).toBeGreaterThan(establishedGain);
  });
});
