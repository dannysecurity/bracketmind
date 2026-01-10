import { describe, expect, it } from "vitest";
import { createBracket, parseTeams, simulateBracket } from "../bracket.js";
import { renderBracketHtml, renderPredictHtml } from "./renderHtml.js";
import { buildPredictEntries } from "./renderPredict.js";

function seededTeams(names: string[]) {
  return parseTeams(names).map((team, index) => ({
    ...team,
    rating: 1700 - index * 50,
  }));
}

describe("renderHtml", () => {
  it("escapes team names and marks winners", () => {
    const teams = parseTeams(["Ace<script>", "Beta", "Gamma", "Delta"]);
    const html = renderBracketHtml(simulateBracket(createBracket(teams)));

    expect(html).toContain("Ace&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('class="team winner"');
    expect(html).toContain("Champion:");
  });

  it("shows seed numbers in match cards and champion line", () => {
    const teams = seededTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const html = renderBracketHtml(simulateBracket(createBracket(teams)));

    expect(html).toContain('<span class="seed">#1</span> Alpha');
    expect(html).toContain('<span class="seed">#4</span> Delta');
    expect(html).toMatch(/Champion: <strong><span class="seed">#\d+<\/span> /);
  });

  it("de-emphasizes losing teams in completed matches", () => {
    const teams = seededTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const html = renderBracketHtml(simulateBracket(createBracket(teams)));

    expect(html).toContain('class="team loser"');
  });

  it("shows BYE field summary for odd-sized brackets", () => {
    const teams = seededTeams(["S1", "S2", "S3"]);
    const html = renderBracketHtml(simulateBracket(createBracket(teams)));

    expect(html).toContain('class="field-summary"');
    expect(html).toContain("1 BYE slot in the field");
    expect(html).toContain("advances (BYE)");
  });

  it("shows upset chance on unplayed matchups", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 100,
    }));
    const html = renderBracketHtml(createBracket(teams));

    expect(html).toContain('class="upset-chance"');
    expect(html).toContain("upset chance");
  });

  it("renders predict bars with percentages", () => {
    const teams = parseTeams(["Alpha", "Beta"]);
    const entries = buildPredictEntries(
      new Map([
        [teams[0].id, 0.62],
        [teams[1].id, 0.38],
      ]),
      teams
    );

    const html = renderPredictHtml(entries);
    expect(html).toContain('class="predict-row"');
    expect(html).toContain("62.0%");
    expect(html).toContain('style="width:62%"');
  });
});
