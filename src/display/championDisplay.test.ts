import { describe, expect, it } from "vitest";
import { createBracket, parseTeams, simulateBracket } from "../bracket.js";
import { renderChampionBanner } from "./championDisplay.js";

describe("renderChampionBanner", () => {
  it("renders a boxed champion line for completed brackets", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 50,
    }));
    const lines = renderChampionBanner(simulateBracket(createBracket(teams)), {
      enabled: false,
    });

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^╔═+╗$/);
    expect(lines[1]).toContain("Champion:");
    expect(lines[2]).toMatch(/^╚═+╝$/);
  });

  it("falls back to TBD when the bracket has no champion", () => {
    const teams = parseTeams(["Alpha", "Beta"]);
    const lines = renderChampionBanner(createBracket(teams), { enabled: false });

    expect(lines).toEqual(["Champion: TBD"]);
  });

  it("applies champion styling when color is enabled", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 50,
    }));
    const lines = renderChampionBanner(simulateBracket(createBracket(teams)), {
      enabled: true,
    });

    expect(lines[1]).toContain("\x1b[33m");
  });
});
