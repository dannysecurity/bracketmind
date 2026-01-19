import { describe, expect, it } from "vitest";
import { renderGameMonteCarloSummary } from "./renderGameMonteCarlo.js";
import type { GameMonteCarloResult, Team } from "../types.js";

function team(id: string, name: string, rating: number): Team {
  return { id, name, rating };
}

describe("renderGameMonteCarloSummary", () => {
  it("renders win bars, averages, and upset rate", () => {
    const teamA = team("a", "Duke", 1650);
    const teamB = team("b", "Kansas", 1500);
    const result: GameMonteCarloResult = {
      iterations: 1000,
      winRateA: 0.712,
      winRateB: 0.288,
      upsetRate: 0.12,
      avgMargin: 7.4,
      marginStdDev: 3.2,
      marginPercentiles: { p10: 4.0, p50: 7.0, p90: 11.0 },
      avgScoreA: 74.2,
      avgScoreB: 66.8,
      analyticalWinRateA: 0.71,
      sampleResult: {
        winner: teamA,
        scoreA: 72,
        scoreB: 65,
        winProbabilityA: 0.71,
        margin: 7,
        isUpset: false,
      },
    };

    const text = renderGameMonteCarloSummary(teamA, teamB, result, {
      enabled: false,
    }).join("\n");

    expect(text).toContain("Head-to-head forecast (1000 simulations)");
    expect(text).toContain("Duke");
    expect(text).toContain("Kansas");
    expect(text).toContain("71.2%");
    expect(text).toContain("Analytical win rate (Duke): 71.0%");
    expect(text).toContain("Avg score: Duke 74.2, Kansas 66.8");
    expect(text).toContain("Avg margin: 7.4 pts (σ 3.2)");
    expect(text).toContain("Margin spread (p10–p90): 4.0–11.0 pts (median 7.0)");
    expect(text).toContain("Upset rate: 12.0%");
  });
});
