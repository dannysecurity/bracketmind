import { describe, expect, it } from "vitest";
import {
  resolveMatchupSeeds,
  withResolvedSeeds,
} from "./seedContext.js";
import type { Team } from "../types.js";

function team(
  name: string,
  rating: number,
  seed?: number
): Team {
  return { id: name.toLowerCase(), name, rating, seed };
}

describe("resolveMatchupSeeds", () => {
  it("prefers explicit option seeds over team seeds", () => {
    expect(
      resolveMatchupSeeds(team("A", 1500, 5), team("B", 1500, 12), {
        seedA: 16,
        seedB: 1,
      })
    ).toEqual({ seedA: 16, seedB: 1 });
  });

  it("falls back to team seeds when options omit them", () => {
    expect(resolveMatchupSeeds(team("A", 1500, 1), team("B", 1500, 16))).toEqual(
      { seedA: 1, seedB: 16 }
    );
  });

  it("returns empty when either side lacks a seed", () => {
    expect(resolveMatchupSeeds(team("A", 1500, 1), team("B", 1500))).toEqual(
      {}
    );
    expect(resolveMatchupSeeds(team("A", 1500), team("B", 1500, 16))).toEqual(
      {}
    );
  });

  it("falls back to bracket seed map when team seeds are omitted", () => {
    const bracketSeeds = new Map([
      ["a", 1],
      ["b", 16],
    ]);

    expect(
      resolveMatchupSeeds(team("A", 1500), team("B", 1500), { bracketSeeds })
    ).toEqual({ seedA: 1, seedB: 16 });
  });

  it("prefers explicit option seeds over bracket seed map entries", () => {
    const bracketSeeds = new Map([
      ["a", 5],
      ["b", 12],
    ]);

    expect(
      resolveMatchupSeeds(team("A", 1500), team("B", 1500), {
        bracketSeeds,
        seedA: 1,
        seedB: 16,
      })
    ).toEqual({ seedA: 1, seedB: 16 });
  });

  it("allows partial seed overrides when the other side has a team seed", () => {
    expect(
      resolveMatchupSeeds(team("A", 1500), team("B", 1500, 16), {
        seedA: 8,
      })
    ).toEqual({ seedA: 8, seedB: 16 });
  });
});

describe("withResolvedSeeds", () => {
  it("injects team seeds into simulation options", () => {
    expect(
      withResolvedSeeds(team("A", 1500, 2), team("B", 1500, 15), {
        historicalWeight: 0.5,
      })
    ).toEqual({
      historicalWeight: 0.5,
      seedA: 2,
      seedB: 15,
    });
  });

  it("returns the original options object when seeds are incomplete", () => {
    const options = { round: 0 };
    expect(withResolvedSeeds(team("A", 1500), team("B", 1500), options)).toBe(
      options
    );
  });
});
