import { describe, expect, it } from "vitest";
import {
  createBracket,
  getChampion,
  parseTeams,
  simulateBracket,
} from "./bracket.js";

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

  it("produces a champion after simulation", () => {
    const teams = parseTeams(["A", "B", "C", "D"]);
    const result = simulateBracket(createBracket(teams));
    const champion = getChampion(result);
    expect(teams.map((t) => t.name)).toContain(champion.name);
  });
});
