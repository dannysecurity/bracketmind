import { describe, expect, it } from "vitest";
import {
  bracketPlacementOrder,
  matchIndex,
  nextPowerOfTwo,
  padTeamsWithByes,
} from "./layout.js";

describe("nextPowerOfTwo", () => {
  it("rounds up to the nearest power of two", () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
  });
});

describe("bracketPlacementOrder", () => {
  it("pairs top seed against bottom seed in an 8-team bracket", () => {
    expect(bracketPlacementOrder(8)).toEqual([0, 7, 3, 4, 1, 6, 2, 5]);
  });
});

describe("matchIndex", () => {
  it("maps round and slot to flat match indices", () => {
    expect(matchIndex(0, 0, 3)).toBe(0);
    expect(matchIndex(1, 0, 3)).toBe(4);
    expect(matchIndex(2, 0, 3)).toBe(6);
  });
});

describe("padTeamsWithByes", () => {
  it("extends a field to the next power of two with BYE placeholders", () => {
    const padded = padTeamsWithByes([
      { id: "a", name: "A", rating: 1600 },
      { id: "b", name: "B", rating: 1500 },
      { id: "c", name: "C", rating: 1400 },
    ]);

    expect(padded).toHaveLength(4);
    expect(padded[3].name).toBe("BYE");
  });
});
