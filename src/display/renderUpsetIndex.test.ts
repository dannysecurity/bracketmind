import { describe, expect, it } from "vitest";
import { parseTeams } from "../bracket.js";
import { renderUpsetIndexSection } from "./renderUpsetIndex.js";

describe("renderUpsetIndexSection", () => {
  it("renders chalk index and seed-line vulnerability", () => {
    const teams = parseTeams([
      "Duke:1650",
      "Kansas:1600",
      "UConn:1550",
      "Purdue:1500",
    ]);
    const lines = renderUpsetIndexSection(teams, { enabled: false });

    expect(lines.join("\n")).toContain("Tournament Upset Index");
    expect(lines.join("\n")).toContain("Chalk index:");
    expect(lines.join("\n")).toContain("Expected total upsets:");
    expect(lines.join("\n")).toContain("Seed-Line Vulnerability");
    expect(lines.join("\n")).toContain("#4 Purdue");
  });
});
