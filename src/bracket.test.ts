import { describe, expect, it } from "vitest";
import {
  createBracket,
  getChampion,
  parseTeamSpec,
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
  it("parses team specs with optional ratings", () => {
    expect(parseTeamSpec("Duke")).toEqual({ name: "Duke", rating: 1500 });
    expect(parseTeamSpec("Duke:1650")).toEqual({ name: "Duke", rating: 1650 });
    expect(parseTeams(["Alpha:1600", "Beta"])).toEqual([
      { id: "team-0", name: "Alpha", rating: 1600 },
      { id: "team-1", name: "Beta", rating: 1500 },
    ]);
  });

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

  it("updates team ratings across rounds when dynamicRatings is enabled", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map(
      (team, i) => ({ ...team, rating: 1600 - i * 50 })
    );
    const result = simulateBracket(createBracket(teams), {
      dynamicRatings: true,
    });

    const playedTeams = result.teams.filter((team) => team.name !== "BYE");
    const ratingsChanged = playedTeams.some(
      (team, i) => team.rating !== 1600 - i * 50
    );

    expect(getChampion(result)).toBeTruthy();
    expect(ratingsChanged).toBe(true);
  });

  it("replays identically when a fixed rng is supplied", () => {
    const teams = parseTeams(["A", "B", "C", "D"]);
    const rngValues = Array.from({ length: 20 }, (_, i) => (i * 17) % 100 / 100);
    let index = 0;
    const rng = () => rngValues[index++ % rngValues.length];

    const first = simulateBracket(createBracket(teams), { rng });
    index = 0;
    const second = simulateBracket(createBracket(teams), { rng });

    expect(getChampion(first).id).toBe(getChampion(second).id);
    expect(first.matches.map((m) => m.scoreA)).toEqual(
      second.matches.map((m) => m.scoreA)
    );
  });
});
