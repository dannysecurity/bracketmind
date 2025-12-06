import { describe, expect, it } from "vitest";
import { createBracket, parseTeams, simulateBracket } from "../bracket.js";
import { renderBracketHtml, renderPredictHtml } from "./renderHtml.js";
import { buildPredictEntries } from "./renderPredict.js";

describe("renderHtml", () => {
  it("escapes team names and marks winners", () => {
    const teams = parseTeams(["Ace<script>", "Beta", "Gamma", "Delta"]);
    const html = renderBracketHtml(simulateBracket(createBracket(teams)));

    expect(html).toContain("Ace&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('class="team winner"');
    expect(html).toContain("Champion:");
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
