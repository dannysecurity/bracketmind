import type { Bracket } from "../types.js";
import {
  buildBracketView,
  type MatchView,
  type TeamView,
} from "./bracketView.js";
import { buildPredictEntries, type PredictEntry } from "./renderPredict.js";

export interface HtmlRenderOptions {
  showSeeds?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function teamCellClass(team: TeamView | null, match: MatchView): string {
  if (!team) {
    return "team";
  }
  if (team.isBye) {
    return "team bye";
  }
  if (match.winner?.name === team.name) {
    return "team winner";
  }
  if (match.winner && match.winner.name !== team.name) {
    return "team loser";
  }
  return "team";
}

function renderTeamLabelHtml(
  team: TeamView | null,
  showSeeds: boolean
): string {
  if (!team) {
    return "TBD";
  }
  if (team.isBye) {
    return "BYE";
  }
  if (showSeeds && team.seed !== null) {
    return `<span class="seed">#${team.seed}</span> ${escapeHtml(team.name)}`;
  }
  return escapeHtml(team.name);
}

function renderMatchCard(match: MatchView, showSeeds: boolean): string {
  const score =
    match.scoreA !== undefined && match.scoreB !== undefined
      ? `<span class="score">${match.scoreA}-${match.scoreB}</span>`
      : "";

  if (match.isByeMatch && match.winner) {
    return `<article class="match bye-match">
      <div class="${teamCellClass(match.winner, match)}">${renderTeamLabelHtml(match.winner, showSeeds)}</div>
      <div class="bye-note">advances (BYE)</div>
    </article>`;
  }

  return `<article class="match">
    <div class="${teamCellClass(match.teamA, match)}">${renderTeamLabelHtml(match.teamA, showSeeds)}</div>
    <div class="${teamCellClass(match.teamB, match)}">${renderTeamLabelHtml(match.teamB, showSeeds)}</div>
    ${score}
  </article>`;
}

function renderFieldSummaryHtml(bracket: Bracket): string {
  const byeCount = bracket.teams.filter((team) => team.name === "BYE").length;
  if (byeCount === 0) {
    return "";
  }
  const label = `${byeCount} BYE slot${byeCount === 1 ? "" : "s"} in the field`;
  return `<p class="field-summary">${escapeHtml(label)}</p>`;
}

function renderChampionHtml(
  champion: TeamView | null,
  showSeeds: boolean
): string {
  if (!champion) {
    return "";
  }
  return `<p class="champion">Champion: <strong>${renderTeamLabelHtml(champion, showSeeds)}</strong></p>`;
}

/** Render a simulated bracket as semantic HTML for the web viewer. */
export function renderBracketHtml(
  bracket: Bracket,
  options: HtmlRenderOptions = {}
): string {
  const showSeeds = options.showSeeds ?? true;
  const view = buildBracketView(bracket);
  const columns = view.matchesByRound
    .map(
      (matches, roundIndex) => `<section class="round">
        <h3>${escapeHtml(view.roundLabels[roundIndex])}</h3>
        ${matches.map((match) => renderMatchCard(match, showSeeds)).join("\n")}
      </section>`
    )
    .join("\n");

  const fieldSummary = renderFieldSummaryHtml(bracket);
  const champion = renderChampionHtml(view.champion, showSeeds);

  return `<div class="bracket-grid">${columns}</div>${fieldSummary}${champion}`;
}

/** Render predict probabilities as HTML bars. */
export function renderPredictHtml(entries: PredictEntry[]): string {
  return `<div class="predict-list">
    ${entries
      .map(
        (entry) => `<div class="predict-row">
          <span class="predict-name">${escapeHtml(entry.team.name)}</span>
          <span class="predict-bar"><span style="width:${Math.round(entry.rate * 100)}%"></span></span>
          <span class="predict-pct">${(entry.rate * 100).toFixed(1)}%</span>
        </div>`
      )
      .join("\n")}
  </div>`;
}

/** Render a full HTML page for the web viewer. */
export function renderViewerPage(
  bracketHtml: string,
  predictHtml: string,
  teams: string[]
): string {
  const teamValue = escapeHtml(teams.join(", "));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>bracketmind viewer</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <main>
    <header>
      <h1>bracketmind</h1>
      <p>Tournament bracket simulator</p>
    </header>
    <form id="bracket-form">
      <label for="teams">Teams (comma-separated)</label>
      <input id="teams" name="teams" value="${teamValue}" required />
      <div class="actions">
        <button type="submit" name="mode" value="simulate">Simulate</button>
        <button type="submit" name="mode" value="predict">Predict</button>
      </div>
    </form>
    <section id="results">
      ${bracketHtml}
      ${predictHtml}
    </section>
  </main>
</body>
</html>`;
}

/** Convenience helper for server responses. */
export function renderSimulatePage(bracket: Bracket, teams: string[]): string {
  return renderViewerPage(renderBracketHtml(bracket), "", teams);
}

export function renderPredictPage(
  rates: Map<string, number>,
  teams: import("../types.js").Team[],
  teamNames: string[]
): string {
  const entries = buildPredictEntries(rates, teams);
  return renderViewerPage("", renderPredictHtml(entries), teamNames);
}
