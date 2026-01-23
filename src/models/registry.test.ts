import { describe, expect, it } from "vitest";
import { GameCatalog, resolveGameOutcome, sortGamesBySlot } from "./gameCatalog.js";
import { TeamRegistry } from "./registry.js";
import type { RecordedGame, SeededTeam } from "./index.js";

const seededField: SeededTeam[] = [
  { id: "uconn", name: "UConn", seed: 1, rating: 1720 },
  { id: "purdue", name: "Purdue", seed: 2, rating: 1680 },
  { id: "houston", name: "Houston", seed: 3, rating: 1705 },
  { id: "tennessee", name: "Tennessee", seed: 4, rating: 1650 },
];

describe("TeamRegistry", () => {
  it("builds from seeded fixture entries via runtime conversion", () => {
    const registry = TeamRegistry.fromSeededTeams(seededField);

    expect(registry.require("uconn")).toEqual({
      id: "uconn",
      name: "UConn",
      seed: 1,
      rating: 1720,
    });
    expect(registry.seedOf("purdue")).toBe(2);
    expect(registry.toArray()).toHaveLength(4);
  });

  it("rejects duplicate team ids", () => {
    expect(() =>
      TeamRegistry.fromTeams([
        { id: "a", name: "Alpha", rating: 1500 },
        { id: "a", name: "Alpha Clone", rating: 1400 },
      ])
    ).toThrow(/Duplicate team id: a/);
  });

  it("throws when resolving unknown ids or seeds", () => {
    const registry = TeamRegistry.fromSeededTeams(seededField);
    expect(() => registry.require("missing")).toThrow(/Unknown team id: missing/);
    expect(() => registry.requireSeed("missing")).toThrow(/No official seed for team id: missing/);
    expect(registry.requireSeed("houston")).toBe(3);
  });
});

describe("GameCatalog", () => {
  const games: RecordedGame[] = [
    {
      round: 1,
      slot: 0,
      teamAId: "uconn",
      teamBId: "tennessee",
      scoreA: 72,
      scoreB: 58,
      winnerId: "uconn",
    },
    {
      round: 0,
      slot: 1,
      teamAId: "purdue",
      teamBId: "houston",
      scoreA: 65,
      scoreB: 70,
      winnerId: "houston",
    },
    {
      round: 0,
      slot: 0,
      teamAId: "uconn",
      teamBId: "purdue",
      scoreA: 80,
      scoreB: 62,
      winnerId: "uconn",
    },
  ];

  it("sorts games by round then slot", () => {
    expect(sortGamesBySlot(games).map((game) => `${game.round}:${game.slot}`)).toEqual([
      "0:0",
      "0:1",
      "1:0",
    ]);
  });

  it("indexes games for O(1) slot lookup", () => {
    const catalog = GameCatalog.fromGames(games);

    expect(catalog.size).toBe(3);
    expect(catalog.requireAt(0, 1).winnerId).toBe("houston");
    expect(catalog.getAt(2, 0)).toBeUndefined();
    expect(() => catalog.requireAt(2, 0)).toThrow(/No game at round 2, slot 0/);
  });

  it("rejects duplicate bracket slots", () => {
    expect(() =>
      GameCatalog.fromGames([
        {
          round: 0,
          slot: 0,
          teamAId: "a",
          teamBId: "b",
          scoreA: 70,
          scoreB: 60,
          winnerId: "a",
        },
        {
          round: 0,
          slot: 0,
          teamAId: "c",
          teamBId: "d",
          scoreA: 55,
          scoreB: 50,
          winnerId: "c",
        },
      ])
    ).toThrow(/Duplicate game at round 0, slot 0/);
  });

  it("resolves participants and upset facts through a registry", () => {
    const registry = TeamRegistry.fromSeededTeams(seededField);
    const catalog = GameCatalog.fromGames(games);
    const game = catalog.requireAt(0, 1);

    expect(catalog.resolveParticipants(game, registry).winner.name).toBe("Houston");

    const outcome = resolveGameOutcome(game, registry);
    expect(outcome.winnerIsA).toBe(false);
    expect(outcome.winnerSeed).toBe(3);
    expect(outcome.loserSeed).toBe(2);
  });
});
