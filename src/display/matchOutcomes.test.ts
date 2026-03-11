import { describe, expect, it } from "vitest";
import { createBracket, parseTeams, simulateBracket } from "../bracket.js";
import { buildBracketView } from "./bracketView.js";
import {
  countUpsets,
  UPSET_LABEL,
  wasMatchUpset,
  wasRatingUpsetMatch,
} from "./matchOutcomes.js";

describe("matchOutcomes", () => {
  it("flags a lower-rated winner as an upset", () => {
    const upset = wasMatchUpset({
      teamA: { name: "Favorite", seed: 1, rating: 1700, isBye: false },
      teamB: { name: "Underdog", seed: 8, rating: 1500, isBye: false },
      winner: { name: "Underdog", seed: 8, rating: 1500, isBye: false },
    });

    expect(upset).toBe(true);
  });

  it("ignores favorite wins and bye advances", () => {
    const favoriteWin = wasMatchUpset({
      teamA: { name: "Favorite", seed: 1, rating: 1700, isBye: false },
      teamB: { name: "Underdog", seed: 8, rating: 1500, isBye: false },
      winner: { name: "Favorite", seed: 1, rating: 1700, isBye: false },
    });
    const byeAdvance = wasMatchUpset({
      teamA: { name: "BYE", seed: null, rating: 0, isBye: true },
      teamB: { name: "Team", seed: 2, rating: 1600, isBye: false },
      winner: { name: "Team", seed: 2, rating: 1600, isBye: false },
    });

    expect(favoriteWin).toBe(false);
    expect(byeAdvance).toBe(false);
  });

  it("detects upsets from raw matches and counts them in the view", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 200,
    }));
    const bracket = createBracket(teams);
    const firstMatch = bracket.matches.find((match) => match.round === 0 && match.slot === 0)!;

    firstMatch.teamA = teams[3];
    firstMatch.teamB = teams[0];
    firstMatch.winner = teams[3];
    firstMatch.scoreA = 72;
    firstMatch.scoreB = 68;

    expect(wasRatingUpsetMatch(firstMatch)).toBe(true);

    const view = buildBracketView(bracket);
    expect(view.matchesByRound[0][0].wasUpset).toBe(true);
    expect(countUpsets(view)).toBe(1);
  });

  it("exports a stable upset label for renderers", () => {
    expect(UPSET_LABEL).toBe("UPSET");
  });

  it("counts upsets in simulated brackets without throwing", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 50,
    }));
    const view = buildBracketView(simulateBracket(createBracket(teams)));

    expect(countUpsets(view)).toBeGreaterThanOrEqual(0);
  });
});
