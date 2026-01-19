import { describe, expect, it } from "vitest";
import {
  bracketGridRowCount,
  displayRow,
  matchExtents,
} from "./bracketLayout.js";

describe("bracketLayout", () => {
  it("places opening-round matches on adjacent row pairs", () => {
    expect(matchExtents(0, 0, 3)).toEqual({ top: 0, bottom: 1, mid: 0.5 });
    expect(matchExtents(0, 2, 3)).toEqual({ top: 4, bottom: 5, mid: 4.5 });
  });

  it("centers later-round matches between their feeders", () => {
    const semifinal = matchExtents(1, 0, 3);
    expect(semifinal.top).toBe(0);
    expect(semifinal.bottom).toBe(3);
    expect(semifinal.mid).toBe(1.5);
    expect(displayRow(semifinal.mid)).toBe(3);
  });

  it("computes grid height from the deepest match midpoint", () => {
    expect(bracketGridRowCount(2, 2)).toBe(6);
    expect(bracketGridRowCount(3, 4)).toBe(14);
  });
});
