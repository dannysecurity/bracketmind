import { describe, expect, it } from "vitest";
import {
  bracketSlotKey,
  bracketSlotOf,
  sameBracketSlot,
} from "./game.js";
import { matchBracketSlot } from "./match.js";
import {
  isByeTeam,
  toRuntimeTeam,
  toSeededTeam,
  type SeededTeam,
  type Team,
} from "./team.js";

const uconn: SeededTeam = {
  id: "uconn",
  name: "UConn",
  seed: 1,
  rating: 1720,
};

describe("team model conversions", () => {
  it("maps seeded fixture entries to runtime teams", () => {
    expect(toRuntimeTeam(uconn)).toEqual({
      id: "uconn",
      name: "UConn",
      seed: 1,
      rating: 1720,
    });
  });

  it("maps runtime teams with seeds back to seeded entries", () => {
    const runtime: Team = { id: "a", name: "Alpha", rating: 1600, seed: 3 };
    expect(toSeededTeam(runtime)).toEqual({
      id: "a",
      name: "Alpha",
      rating: 1600,
      seed: 3,
    });
  });

  it("returns undefined when a runtime team has no official seed", () => {
    expect(toSeededTeam({ id: "cli", name: "CLI Team", rating: 1500 })).toBeUndefined();
  });

  it("detects BYE placeholders by name", () => {
    expect(isByeTeam({ id: "bye-0", name: "BYE", rating: 0 })).toBe(true);
    expect(isByeTeam({ id: "a", name: "Alpha", rating: 1500 })).toBe(false);
    expect(isByeTeam(null)).toBe(false);
  });
});

describe("bracket slot helpers", () => {
  it("builds stable keys for round and slot pairs", () => {
    expect(bracketSlotKey({ round: 2, slot: 1 })).toBe("2:1");
  });

  it("compares bracket slots by coordinates", () => {
    const left = { round: 0, slot: 1 };
    const right = { round: 0, slot: 1 };
    const other = { round: 1, slot: 0 };

    expect(sameBracketSlot(left, right)).toBe(true);
    expect(sameBracketSlot(left, other)).toBe(false);
  });

  it("copies bracket coordinates without extra fields", () => {
    expect(bracketSlotOf({ round: 3, slot: 0 })).toEqual({ round: 3, slot: 0 });
  });

  it("extracts bracket coordinates from a match", () => {
    expect(
      matchBracketSlot({
        id: "m-4",
        round: 1,
        slot: 0,
        teamA: null,
        teamB: null,
        winner: null,
      })
    ).toEqual({ round: 1, slot: 0 });
  });
});
