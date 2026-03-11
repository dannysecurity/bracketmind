import { describe, expect, it } from "vitest";
import { createBracket, parseTeams, simulateBracket } from "../bracket.js";
import {
  renderBracketHtml,
  renderPredictHtml,
  renderViewerPage,
} from "./renderHtml.js";
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
    expect(html).toContain('class="champion-card"');
    expect(html).toContain('<h2 class="section-heading">Simulated bracket</h2>');
  });

  it("shows seed numbers in match cards and champion line", () => {
    const teams = seededTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const html = renderBracketHtml(simulateBracket(createBracket(teams)));

    expect(html).toContain('<span class="seed">#1</span> Alpha');
    expect(html).toContain('<span class="seed">#4</span> Delta');
    expect(html).toMatch(/class="champion-name">[\s\S]*?<span class="seed">#\d+<\/span> /);
  });

  it("de-emphasizes losing teams in completed matches", () => {
    const teams = seededTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const html = renderBracketHtml(simulateBracket(createBracket(teams)));

    expect(html).toContain('class="team loser"');
  });

  it("shows scores inline on the winning team row", () => {
    const teams = seededTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const html = renderBracketHtml(simulateBracket(createBracket(teams)));

    expect(html).toContain('class="score-inline"');
    expect(html).not.toContain('class="score"');
    expect(html).toMatch(
      /class="team winner">[\s\S]*?<span class="score-inline">\d+-\d+<\/span>/
    );
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

    const html = renderPredictHtml(entries, { iterations: 1000 });
    expect(html).toContain('<h2 class="section-heading">Championship probabilities (1,000 simulations)</h2>');
    expect(html).toContain('class="predict-row"');
    expect(html).toContain('<span class="seed">#1</span> Alpha');
    expect(html).toContain("62.0%");
    expect(html).toContain('style="width:62%"');
  });

  it("renders aligned bracket layout with grid positioning", () => {
    const teams = seededTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const html = renderBracketHtml(simulateBracket(createBracket(teams)), { format: "aligned" });

    expect(html).toContain('class="bracket-grid aligned"');
    expect(html).toContain('class="round aligned-round"');
    expect(html).toContain('style="--bracket-rows: 6"');
    expect(html).toContain('class="aligned-match"');
    expect(html).toContain('style="grid-row:');
    expect(html).toContain('class="match-connector"');
  });

  it("keeps card columns when format is cards", () => {
    const teams = seededTeams(["Alpha", "Beta", "Gamma", "Delta"]);
    const html = renderBracketHtml(simulateBracket(createBracket(teams)), { format: "cards" });

    expect(html).toContain('class="bracket-grid"');
    expect(html).not.toContain("bracket-grid aligned");
    expect(html).not.toContain("aligned-match");
  });

  it("marks upset wins with a badge and summary line", () => {
    const teams = parseTeams(["Alpha", "Beta", "Gamma", "Delta"]).map((team, index) => ({
      ...team,
      rating: 1700 - index * 200,
    }));
    const bracket = createBracket(teams);
    const firstMatch = bracket.matches.find((match) => match.round === 0 && match.slot === 0)!;
    firstMatch.teamA = teams[3];
    firstMatch.teamB = teams[0];
    firstMatch.winner = teams[3];
    firstMatch.scoreA = 72;
    firstMatch.scoreB = 68;

    const html = renderBracketHtml(bracket);

    expect(html).toContain('class="match upset-match"');
    expect(html).toContain('class="upset-badge"');
    expect(html).toContain("UPSET");
    expect(html).toContain('class="upset-summary"');
    expect(html).toContain("1 rating upset in this bracket");
  });

  it("includes layout controls and rating hint in the viewer form", () => {
    const page = renderViewerPage("", "", ["Duke", "Kansas"], {
      format: "aligned",
      iterations: 2500,
      mode: "both",
      seed: 42,
    });

    expect(page).toContain('name="format"');
    expect(page).toContain('value="aligned" selected');
    expect(page).toContain('name="iterations"');
    expect(page).toContain('value="2500"');
    expect(page).toContain('name="seed"');
    expect(page).toContain('value="42"');
    expect(page).toContain("Same seed replays identical bracket outcomes");
    expect(page).toContain('value="both"');
    expect(page).toContain("Name:rating");
  });
});
