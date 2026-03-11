import { describe, expect, it } from "vitest";
import { renderGameResult } from "./renderGameResult.js";
import type { SimulationResult, Team } from "../types.js";

function team(id: string, name: string, rating: number): Team {
  return { id, name, rating };
}

describe("renderGameResult", () => {
  it("shows scores, favorite, and upset label", () => {
    const teamA = team("a", "Duke", 1650);
    const teamB = team("b", "Kansas", 1500);
    const result: SimulationResult = {
      winner: teamB,
      scoreA: 68,
      scoreB: 72,
      winProbabilityA: 0.71,
      margin: 4,
      isUpset: true,
    };

    const lines = renderGameResult(teamA, teamB, result, { enabled: false });

    expect(lines.join("\n")).toContain("Duke (1650) vs Kansas (1500)");
    expect(lines.join("\n")).toContain("→ Duke 68 - Kansas 72");
    expect(lines.join("\n")).toContain("Pre-game favorite: Duke 71%");
    expect(lines.join("\n")).toContain("Result: upset");
  });

  it("includes rating deltas when requested", () => {
    const teamA = team("a", "Alpha", 1500);
    const teamB = team("b", "Beta", 1500);
    const result: SimulationResult = {
      winner: teamA,
      scoreA: 70,
      scoreB: 65,
      winProbabilityA: 0.5,
      margin: 5,
      isUpset: false,
      ratingDeltaA: 16,
      ratingDeltaB: -16,
    };

    const lines = renderGameResult(teamA, teamB, result, {
      enabled: false,
      showRatingDeltas: true,
    });

    expect(lines.join("\n")).toContain("Rating change: Alpha +16, Beta -16");
  });

  it("shows round context when round and total rounds are provided", () => {
    const teamA = team("a", "Duke", 1650);
    const teamB = team("b", "Kansas", 1500);
    const result: SimulationResult = {
      winner: teamA,
      scoreA: 72,
      scoreB: 68,
      winProbabilityA: 0.71,
      margin: 4,
      isUpset: false,
    };

    const lines = renderGameResult(teamA, teamB, result, {
      enabled: false,
      round: 3,
      totalRounds: 4,
    });

    expect(lines.join("\n")).toContain("Round context: Final");
  });

  it("shows historical seed blend context when seeds and weight are provided", () => {
    const teamA = team("a", "UMBC", 1450);
    const teamB = team("b", "Virginia", 1700);
    const result: SimulationResult = {
      winner: teamB,
      scoreA: 58,
      scoreB: 74,
      winProbabilityA: 0.02,
      margin: 16,
      isUpset: false,
    };

    const lines = renderGameResult(teamA, teamB, result, {
      enabled: false,
      seedA: 16,
      seedB: 1,
      historicalWeight: 0.35,
    });

    expect(lines.join("\n")).toContain("Seeds: #16 vs #1");
    expect(lines.join("\n")).toContain("historical upset rates (35%)");
  });
});
