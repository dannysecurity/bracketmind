import { describe, expect, it } from "vitest";
import { parseTeams } from "../bracket.js";
import { renderUpsetsSection } from "./renderUpsets.js";

describe("renderUpsetsSection", () => {
  it("renders round-by-round upset analysis and an overall highlight", () => {
    const teams = parseTeams(["Duke:1650", "Kansas:1600", "UConn:1550", "Purdue:1500"]);
    const output = renderUpsetsSection(teams, { enabled: false }).join("\n");

    expect(output).toContain("Tournament Upset Landscape");
    expect(output).toContain("Semifinals");
    expect(output).toContain("Final");
    expect(output).toContain("Most Likely Upset");
    expect(output).toContain("#2 Kansas vs #3 UConn");
    expect(output).toContain("upset chance");
  });

  it("notes bye fields without playable round-one upsets beyond byes", () => {
    const teams = parseTeams(["Alpha:1700", "Beta:1600", "Gamma:1500"]);
    const output = renderUpsetsSection(teams, { enabled: false }).join("\n");

    expect(output).toContain("Tournament Upset Landscape");
    expect(output).toContain("Semifinals");
  });
});
