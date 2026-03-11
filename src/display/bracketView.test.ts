import { describe, expect, it } from "vitest";
import { createBracket, parseTeams, simulateBracket } from "../bracket.js";
import { buildBracketView, formatTeamLabel, formatUpsetChance, roundLabel } from "./bracketView.js";

describe("buildBracketView", () => {
  it("labels rounds relative to the final", () => {
    expect(roundLabel(0, 3)).toBe("Quarterfinals");
    expect(roundLabel(1, 3)).toBe("Semifinals");
    expect(roundLabel(2, 3)).toBe("Final");
  });

  it("groups matches by round with seed numbers", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 50,
    }));
    const view = buildBracketView(simulateBracket(createBracket(teams)));

    expect(view.matchesByRound).toHaveLength(2);
    expect(view.matchesByRound[0]).toHaveLength(2);
    expect(view.matchesByRound[0][0].teamA?.seed).toBe(1);
    expect(view.matchesByRound[0][0].teamB?.seed).toBe(4);
    expect(view.champion).not.toBeNull();
  });

  it("marks bye matches in odd-sized fields", () => {
    const teams = parseTeams(["S1", "S2", "S3"]).map((team, index) => ({
      ...team,
      rating: 1600 - index * 100,
    }));
    const view = buildBracketView(simulateBracket(createBracket(teams)));
    const byeMatch = view.matchesByRound[0].find((match) => match.isByeMatch);

    expect(byeMatch).toBeDefined();
    expect(byeMatch?.winner?.name).toBe("S1");
  });

  it("computes pre-game upset chance from seed ratings", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 100,
    }));
    const view = buildBracketView(createBracket(teams));
    const match = view.matchesByRound[0][0];
    const favoriteRating = Math.max(match.teamA!.rating, match.teamB!.rating);
    const underdogRating = Math.min(match.teamA!.rating, match.teamB!.rating);

    expect(match.upsetChance).toBeCloseTo(
      1 / (1 + Math.pow(10, (favoriteRating - underdogRating) / 400))
    );
  });

  it("leaves upset chance null for bye matchups", () => {
    const teams = parseTeams(["S1", "S2", "S3"]).map((team, index) => ({
      ...team,
      rating: 1600 - index * 100,
    }));
    const view = buildBracketView(createBracket(teams));
    const byeMatch = view.matchesByRound[0].find((match) => match.isByeMatch);

    expect(byeMatch?.upsetChance).toBeNull();
    expect(byeMatch?.wasUpset).toBe(false);
  });

  it("flags rating upsets on completed matches", () => {
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

    const view = buildBracketView(bracket);

    expect(view.matchesByRound[0][0].wasUpset).toBe(true);
  });
});

describe("formatUpsetChance", () => {
  it("rounds probability to a whole percentage", () => {
    expect(formatUpsetChance(0.237)).toBe("24% upset chance");
  });
});

describe("formatTeamLabel", () => {
  it("includes seed prefix for ranked teams", () => {
    expect(
      formatTeamLabel({ name: "Duke", seed: 1, rating: 1700, isBye: false })
    ).toBe("#1 Duke");
  });

  it("returns BYE for bye slots", () => {
    expect(
      formatTeamLabel({ name: "BYE", seed: null, rating: 0, isBye: true })
    ).toBe("BYE");
  });

  it("omits seeds when disabled", () => {
    expect(
      formatTeamLabel(
        { name: "Duke", seed: 1, rating: 1700, isBye: false },
        false
      )
    ).toBe("Duke");
  });
});
