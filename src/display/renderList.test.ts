import { describe, expect, it } from "vitest";
import { createBracket, parseTeams, simulateBracket } from "../bracket.js";
import { renderBracketList, renderChampionLine } from "./renderList.js";

describe("renderBracketList", () => {
  it("uses round names instead of generic round numbers", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const lines = renderBracketList(simulateBracket(createBracket(teams)), {
      enabled: false,
    });

    expect(lines.some((line) => line.includes("Semifinals"))).toBe(true);
    expect(lines.some((line) => line.includes("Final"))).toBe(true);
    expect(lines.some((line) => line.includes("Round 1"))).toBe(false);
  });

  it("shows seed numbers and scores when available", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 50,
    }));
    const lines = renderBracketList(simulateBracket(createBracket(teams)), {
      enabled: false,
    });

    expect(lines.some((line) => line.includes("#1 Alpha"))).toBe(true);
    expect(lines.some((line) => line.includes("→"))).toBe(true);
  });

  it("formats champion line with seed", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 50,
    }));
    const result = simulateBracket(createBracket(teams));
    const championLine = renderChampionLine(result, { enabled: false });

    expect(championLine).toMatch(/^Champion: #\d+ /);
  });

  it("shows upset chance on unplayed matchups", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 100,
    }));
    const lines = renderBracketList(createBracket(teams), { enabled: false });

    expect(lines.some((line) => line.includes("upset chance"))).toBe(true);
    expect(lines.some((line) => line.includes("→"))).toBe(false);
  });

  it("de-emphasizes losing teams in completed matches when color is enabled", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 50,
    }));
    const lines = renderBracketList(simulateBracket(createBracket(teams)), {
      enabled: true,
    });

    expect(lines.some((line) => line.includes("\x1b[2m"))).toBe(true);
  });
});
