import type { Bracket } from "../types.js";
import { buildBracketView, type MatchView } from "./bracketView.js";
import { buildPredictEntries, type PredictEntry } from "./renderPredict.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function teamCellClass(teamName: string, match: MatchView): string {
  if (match.winner?.name === teamName) {
    return "team winner";
  }
  if (teamName === "BYE") {
    return "team bye";
  }
  return "team";
}

function renderMatchCard(match: MatchView): string {
  const teamA = match.teamA?.name ?? "TBD";
  const teamB = match.teamB?.name ?? "TBD";
  const score =
    match.scoreA !== undefined && match.scoreB !== undefined
      ? `<span class="score">${match.scoreA}-${match.scoreB}</span>`
      : "";

  if (match.isByeMatch && match.winner) {
    return `<article class="match bye-match">
      <div class="${teamCellClass(match.winner.name, match)}">${escapeHtml(match.winner.name)}</div>
      <div class="bye-note">BYE</div>
    </article>`;
  }

  return `<article class="match">
    <div class="${teamCellClass(teamA, match)}">${escapeHtml(teamA)}</div>
    <div class="${teamCellClass(teamB, match)}">${escapeHtml(teamB)}</div>
    ${score}
  </article>`;
}

/** Render a simulated bracket as semantic HTML for the web viewer. */
export function renderBracketHtml(bracket: Bracket): string {
  const view = buildBracketView(bracket);
  const columns = view.matchesByRound
    .map(
      (matches, roundIndex) => `<section class="round">
        <h3>${escapeHtml(view.roundLabels[roundIndex])}</h3>
        ${matches.map(renderMatchCard).join("\n")}
      </section>`
    )
    .join("\n");

  const champion = view.champion
    ? `<p class="champion">Champion: <strong>${escapeHtml(view.champion.name)}</strong></p>`
    : "";

  return `<div class="bracket-grid">${columns}</div>${champion}`;
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
