import { describe, expect, it } from "vitest";
import { validateRecordedGames } from "./gameValidation.js";
import { Season } from "./season.js";
import { validateConsecutiveSeeds, validateUniqueTeamIds } from "./teamValidation.js";
import type { RecordedGame, SeededTeam } from "./index.js";

const seededField: SeededTeam[] = [
  { id: "a", name: "Alpha", seed: 1, rating: 1700 },
  { id: "b", name: "Beta", seed: 2, rating: 1600 },
  { id: "c", name: "Charlie", seed: 3, rating: 1500 },
  { id: "d", name: "Delta", seed: 4, rating: 1400 },
];

const sampleGames: RecordedGame[] = [
  {
    round: 0,
    slot: 0,
    teamAId: "a",
    teamBId: "d",
    scoreA: 80,
    scoreB: 70,
    winnerId: "a",
  },
  {
    round: 0,
    slot: 1,
    teamAId: "b",
    teamBId: "c",
    scoreA: 75,
    scoreB: 72,
    winnerId: "b",
  },
  {
    round: 1,
    slot: 0,
    teamAId: "a",
    teamBId: "b",
    scoreA: 68,
    scoreB: 65,
    winnerId: "a",
  },
];

describe("team validation", () => {
  it("rejects duplicate team ids", () => {
    expect(() =>
      validateUniqueTeamIds([
        { id: "dup", name: "One", seed: 1, rating: 1600 },
        { id: "dup", name: "Two", seed: 2, rating: 1500 },
      ])
    ).toThrow(/Duplicate team id/);
  });

  it("requires consecutive seeds from one", () => {
    expect(() =>
      validateConsecutiveSeeds([
        { id: "a", name: "A", seed: 1, rating: 1600 },
        { id: "b", name: "B", seed: 3, rating: 1500 },
      ])
    ).toThrow(/consecutive integers/);
  });
});

describe("recorded game validation", () => {
  const teamIds = new Set(seededField.map((team) => team.id));

  it("accepts valid games for the bracket geometry", () => {
    expect(() =>
      validateRecordedGames(sampleGames, teamIds, seededField.length)
    ).not.toThrow();
  });

  it("rejects games where both participants share the same team id", () => {
    expect(() =>
      validateRecordedGames(
        [
          {
            round: 0,
            slot: 0,
            teamAId: "a",
            teamBId: "a",
            scoreA: 70,
            scoreB: 60,
            winnerId: "a",
          },
        ],
        teamIds,
        seededField.length
      )
    ).toThrow(/must be different/);
  });

  it("rejects winners that did not outscore the loser", () => {
    expect(() =>
      validateRecordedGames(
        [
          {
            round: 0,
            slot: 0,
            teamAId: "a",
            teamBId: "d",
            scoreA: 70,
            scoreB: 80,
            winnerId: "a",
          },
        ],
        teamIds,
        seededField.length
      )
    ).toThrow(/outscore/);
  });
});

describe("Season model", () => {
  it("indexes teams and games from a document", () => {
    const season = Season.fromDocument({
      id: "demo",
      name: "Demo",
      year: 2024,
      teams: seededField,
      games: sampleGames,
    });

    expect(season.teamCount).toBe(4);
    expect(season.expectedGames).toBe(3);
    expect(season.recordedGames).toBe(3);
    expect(season.registry.require("a").name).toBe("Alpha");
    expect(season.catalog.requireAt(1, 0).winnerId).toBe("a");
  });

  it("round-trips through toDocument", () => {
    const doc = {
      id: "demo",
      name: "Demo",
      year: 2024,
      teams: seededField,
      games: sampleGames,
    };

    expect(Season.fromDocument(doc).toDocument()).toEqual(doc);
  });

  it("exposes runtime teams for bracket construction", () => {
    const teams = Season.fromDocument({
      id: "demo",
      name: "Demo",
      year: 2024,
      teams: seededField,
      games: [],
    }).toRuntimeTeams();

    expect(teams.map((team) => team.id)).toEqual(["a", "b", "c", "d"]);
    expect(teams.every((team) => team.seed != null)).toBe(true);
  });

  it("rejects invalid recorded games when building from a document", () => {
    expect(() =>
      Season.fromDocument({
        id: "demo",
        name: "Demo",
        year: 2024,
        teams: seededField,
        games: [
          {
            round: 0,
            slot: 0,
            teamAId: "a",
            teamBId: "d",
            scoreA: 70,
            scoreB: 80,
            winnerId: "a",
          },
        ],
      })
    ).toThrow(/outscore/);
  });
});
