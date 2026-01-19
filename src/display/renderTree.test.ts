import { describe, expect, it } from "vitest";
import { createBracket, parseTeams, simulateBracket } from "../bracket.js";
import { renderBracketTree } from "./renderTree.js";

describe("renderBracketTree", () => {
  it("renders a tree with round headers for four teams", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const lines = renderBracketTree(simulateBracket(createBracket(teams)), {
      enabled: false,
    });

    expect(lines[0]).toContain("Semifinals");
    expect(lines[0]).toContain("Final");
    expect(lines.join("\n")).toContain("Alpha");
    expect(lines.join("\n")).toContain("Delta");
  });

  it("shows each opening-round team in the first column", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const teams = parseTeams(names);
    const tree = renderBracketTree(simulateBracket(createBracket(teams)), {
      enabled: false,
      nameWidth: 8,
    }).join("\n");

    for (const name of names) {
      expect(tree).toContain(name);
    }
  });

  it("shows first-round scores on the winning team row", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const tree = renderBracketTree(simulateBracket(createBracket(teams)), {
      enabled: false,
    }).join("\n");

    expect(tree).toMatch(/\(\d+-\d+\)/);
  });

  it("auto-sizes columns for long team names", () => {
    const teams = parseTeams([
      "Very Long Team Name A",
      "B",
      "Very Long Team Name C",
      "D",
    ]);
    const tree = renderBracketTree(simulateBracket(createBracket(teams)), {
      enabled: false,
    }).join("\n");

    expect(tree).toContain("Very Long Team Name A");
    expect(tree).not.toContain("Very Long Team Na…");
  });

  it("shows upset chance on unplayed matchups", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 100,
    }));
    const tree = renderBracketTree(createBracket(teams), { enabled: false }).join("\n");

    expect(tree).toContain("upset chance");
  });
});
