import { describe, expect, it } from "vitest";
import { parseTeams } from "../bracket.js";
import { renderSeedingsSection } from "./renderSeedings.js";

describe("renderSeedingsSection", () => {
  it("lists seeds, matchups, and the most likely upset", () => {
    const teams = parseTeams(["Duke:1650", "Kansas:1600", "UConn:1550", "Purdue:1500"]);
    const lines = renderSeedingsSection(teams, { enabled: false });

    expect(lines.join("\n")).toContain("Bracket Seedings");
    expect(lines.join("\n")).toContain("#1 Duke (1650)");
    expect(lines.join("\n")).toContain("Round 1 Matchups");
    expect(lines.join("\n")).toContain("#1 Duke vs #4 Purdue");
    expect(lines.join("\n")).toContain("upset chance");
    expect(lines.join("\n")).toContain("Most likely first-round upset:");
    expect(lines.join("\n")).toContain("Round 1 Upset Outlook");
    expect(lines.join("\n")).toContain("Expected first-round upsets:");
  });

  it("shows bye advancement for odd-sized fields", () => {
    const teams = parseTeams(["Alpha:1700", "Beta:1600", "Gamma:1500"]);
    const lines = renderSeedingsSection(teams, { enabled: false });

    expect(lines.join("\n")).toContain("advances (BYE)");
  });
});
