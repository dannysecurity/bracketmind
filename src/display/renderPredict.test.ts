import { describe, expect, it } from "vitest";
import { parseTeams } from "../bracket.js";
import { renderPredictBars, renderPredictSection } from "./renderPredict.js";

describe("renderPredictBars", () => {
  it("sorts teams by probability and excludes byes", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma"]);
    const rates = new Map([
      [teams[0].id, 0.5],
      [teams[1].id, 0.3],
      [teams[2].id, 0.2],
      ["bye-3", 0.0],
    ]);

    const lines = renderPredictBars(rates, teams, { enabled: false });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Alpha");
    expect(lines[0]).toContain("50.0%");
    expect(lines[1]).toContain("Beta");
    expect(lines[2]).toContain("Gamma");
  });

  it("renders a titled section", () => {
    const teams = parseTeams(["Alpha", "Beta"]);
    const rates = new Map([
      [teams[0].id, 0.6],
      [teams[1].id, 0.4],
    ]);

    const lines = renderPredictSection(rates, teams, 250, { enabled: false });
    expect(lines[0]).toContain("250 simulations");
    expect(lines.some((line) => line.includes("█"))).toBe(true);
  });
});
