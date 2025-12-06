import { describe, expect, it } from "vitest";
import { createBracket, parseTeams, simulateBracket } from "../bracket.js";
import { buildBracketView, roundLabel } from "./bracketView.js";

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
});
