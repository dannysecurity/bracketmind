import { describe, expect, it } from "vitest";
import {
  createBracket,
  getChampion,
  parseTeams,
  simulateBracket,
} from "./bracket.js";
import type { Team } from "./types.js";

function teamsByRatingRank(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => b.rating - a.rating);
}

function roundOnePairings(bracket: ReturnType<typeof createBracket>): Team[][] {
  return bracket.matches
    .filter((m) => m.round === 0)
    .map((m) => [m.teamA!, m.teamB!]);
}

describe("bracket", () => {
  it("builds a bracket for four teams", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const bracket = createBracket(teams);
    expect(bracket.rounds).toBe(2);
    expect(bracket.matches).toHaveLength(3);
  });

  it("pads odd team counts to the next power of two", () => {
    const teams = parseTeams(["A", "B", "C"]);
    const bracket = createBracket(teams);
    expect(bracket.teams).toHaveLength(4);
  });

  it("pairs round one using standard tournament seeding", () => {
    const teams = parseTeams(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]).map(
      (team, i) => ({ ...team, rating: 1700 - i * 50 })
    );
    const ranked = teamsByRatingRank(teams);
    const pairings = roundOnePairings(createBracket(teams));

    expect(pairings).toHaveLength(4);
    expect(pairings).toEqual([
      [ranked[0], ranked[7]],
      [ranked[3], ranked[4]],
      [ranked[1], ranked[6]],
      [ranked[2], ranked[5]],
    ]);
  });

  it("gives the top seed a bye when the field is not a power of two", () => {
    const teams = parseTeams(["S1", "S2", "S3"]).map((team, i) => ({
      ...team,
      rating: 1600 - i * 100,
    }));
    const topSeed = teamsByRatingRank(teams)[0];
    const pairings = roundOnePairings(createBracket(teams));

    expect(pairings.some(([a, b]) => a === topSeed && b.name === "BYE")).toBe(
      true
    );
  });

  it("produces a champion after simulation", () => {
    const teams = parseTeams(["A", "B", "C", "D"]);
    const result = simulateBracket(createBracket(teams));
    const champion = getChampion(result);
    expect(teams.map((t) => t.name)).toContain(champion.name);
  });
});
