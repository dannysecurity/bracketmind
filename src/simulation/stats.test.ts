import { describe, expect, it } from "vitest";
import { marginStdDev, percentile, summarizeMargins } from "./stats.js";

describe("percentile edge cases", () => {
  it("returns zero when the sorted input is empty", () => {
    expect(percentile([], 0)).toBe(0);
    expect(percentile([], 50)).toBe(0);
    expect(percentile([], 100)).toBe(0);
  });

  it("returns the sole element for any percentile when only one value exists", () => {
    expect(percentile([42], 10)).toBe(42);
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 90)).toBe(42);
  });

  it("linearly interpolates between two sorted margins", () => {
    expect(percentile([8, 16], 50)).toBe(12);
    expect(percentile([8, 16], 10)).toBeCloseTo(8.8, 5);
    expect(percentile([8, 16], 90)).toBeCloseTo(15.2, 5);
  });
});

describe("marginStdDev edge cases", () => {
  it("returns zero for empty margin lists", () => {
    expect(marginStdDev([], 0)).toBe(0);
  });

  it("returns zero when only one margin was recorded", () => {
    expect(marginStdDev([11], 11)).toBe(0);
  });

  it("computes spread once two or more margins are available", () => {
    const margins = [10, 14];
    const avg = 12;
    expect(marginStdDev(margins, avg)).toBeCloseTo(2, 5);
  });
});

describe("summarizeMargins edge cases", () => {
  it("returns zero spread and percentile statistics for empty input", () => {
    const summary = summarizeMargins([], 0);

    expect(summary.marginStdDev).toBe(0);
    expect(summary.marginPercentiles).toEqual({ p10: 0, p50: 0, p90: 0 });
  });

  it("collapses all percentiles to the lone margin when one trial was run", () => {
    const summary = summarizeMargins([9], 9);

    expect(summary.marginStdDev).toBe(0);
    expect(summary.marginPercentiles).toEqual({ p10: 9, p50: 9, p90: 9 });
  });
});
