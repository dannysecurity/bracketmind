import { describe, expect, it } from "vitest";
import { parseTeams } from "../bracket.js";
import { computeTournamentUpsetIndex } from "./upsetIndex.js";

describe("computeTournamentUpsetIndex", () => {
  it("returns a high chalk index when favorites dominate a lopsided field", () => {
    const teams = parseTeams([
      "Alpha:1800",
      "Beta:1500",
      "Gamma:1400",
      "Delta:1300",
    ]);
    const index = computeTournamentUpsetIndex(teams, { historicalWeight: 0 });

    expect(index.chalkIndex).toBeGreaterThan(70);
    expect(index.expectedTotalUpsets).toBeLessThan(1);
    expect(index.roundExposures).toHaveLength(2);
    expect(index.roundOneOutlook.expectedRoundOneUpsets).toBeGreaterThan(0);
  });

  it("returns a lower chalk index when ratings are tightly packed", () => {
    const chalky = computeTournamentUpsetIndex(
      parseTeams(["S1:1700", "S2:1600", "S3:1550", "S4:1500"]),
      { historicalWeight: 0 }
    );
    const volatile = computeTournamentUpsetIndex(
      parseTeams(["S1:1555", "S2:1550", "S3:1545", "S4:1540"]),
      { historicalWeight: 0 }
    );

    expect(volatile.chalkIndex).toBeLessThan(chalky.chalkIndex);
    expect(volatile.expectedTotalUpsets).toBeGreaterThan(
      chalky.expectedTotalUpsets
    );
  });

  it("increases expected upsets when historical seed rates are blended in", () => {
    const eloOnly = computeTournamentUpsetIndex(
      parseTeams(["S1:1700", "S2:1600", "S3:1550", "S4:1500"]),
      { historicalWeight: 0 }
    );
    const blended = computeTournamentUpsetIndex(
      parseTeams(["S1:1700", "S2:1600", "S3:1550", "S4:1500"]),
      { historicalWeight: 1 }
    );

    expect(blended.expectedTotalUpsets).toBeGreaterThanOrEqual(
      eloOnly.expectedTotalUpsets
    );
    expect(blended.roundOneOutlook.expectedRoundOneUpsets).toBeGreaterThanOrEqual(
      eloOnly.roundOneOutlook.expectedRoundOneUpsets
    );
  });

  it("ranks seed-line exposure by underdog upset mass", () => {
    const teams = parseTeams([
      "Duke:1650",
      "Kansas:1600",
      "UConn:1550",
      "Purdue:1500",
    ]);
    const index = computeTournamentUpsetIndex(teams);

    expect(index.seedLineExposures.length).toBe(3);
    expect(index.mostVolatileSeedLine?.seed).toBe(
      index.seedLineExposures[0]?.seed
    );
    expect(
      index.seedLineExposures.some((line) => line.teamName === "Purdue")
    ).toBe(true);
    expect(index.seedLineExposures[0]!.underdogExposure).toBeGreaterThan(
      index.seedLineExposures[1]!.underdogExposure
    );
  });

  it("clamps chalk index between 0 and 100", () => {
    const index = computeTournamentUpsetIndex(
      parseTeams(["A:1550", "B:1549", "C:1548", "D:1547"])
    );

    expect(index.chalkIndex).toBeGreaterThanOrEqual(0);
    expect(index.chalkIndex).toBeLessThanOrEqual(100);
  });
});
