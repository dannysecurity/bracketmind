import { describe, expect, it } from "vitest";
import { renderGameSeries } from "./renderGameSeries.js";
import type { SeriesSimulationResult, Team } from "../types.js";

function team(id: string, name: string, rating: number): Team {
  return { id, name, rating };
}

describe("renderGameSeries", () => {
  it("renders per-game scores and the series winner", () => {
    const teamA = team("a", "Duke", 1650);
    const teamB = team("b", "Kansas", 1500);
    const result: SeriesSimulationResult = {
      bestOf: 3,
      winsA: 1,
      winsB: 2,
      winner: teamB,
      teamA,
      teamB,
      games: [
        {
          winner: teamA,
          scoreA: 72,
          scoreB: 68,
          winProbabilityA: 0.71,
          margin: 4,
          isUpset: false,
        },
        {
          winner: teamB,
          scoreA: 65,
          scoreB: 70,
          winProbabilityA: 0.71,
          margin: 5,
          isUpset: true,
        },
        {
          winner: teamB,
          scoreA: 68,
          scoreB: 74,
          winProbabilityA: 0.71,
          margin: 6,
          isUpset: false,
        },
      ],
    };

    const text = renderGameSeries(teamA, teamB, result, {
      enabled: false,
    }).join("\n");

    expect(text).toContain("Best-of-3 Series");
    expect(text).toContain("Duke (1650) vs Kansas (1500)");
    expect(text).toContain("Game 1: Duke 72 - Kansas 68");
    expect(text).toContain("Game 2: Duke 65 - Kansas 70");
    expect(text).toContain("upset");
    expect(text).toContain("Series: Kansas wins 2-1");
  });

  it("shows final ratings when rating deltas are enabled", () => {
    const teamA = team("a", "Alpha", 1516);
    const teamB = team("b", "Beta", 1484);
    const result: SeriesSimulationResult = {
      bestOf: 1,
      winsA: 1,
      winsB: 0,
      winner: teamA,
      teamA,
      teamB,
      games: [
        {
          winner: teamA,
          scoreA: 70,
          scoreB: 65,
          winProbabilityA: 0.55,
          margin: 5,
          isUpset: false,
          ratingDeltaA: 16,
          ratingDeltaB: -16,
        },
      ],
    };

    const text = renderGameSeries(teamA, teamB, result, {
      enabled: false,
      showRatingDeltas: true,
    }).join("\n");

    expect(text).toContain("Final ratings: Alpha 1516, Beta 1484");
  });
});
