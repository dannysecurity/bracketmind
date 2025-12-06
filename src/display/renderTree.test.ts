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
});
