import type { Bracket } from "../types.js";
import {
  bracketGridRowCount,
  displayRow,
  matchExtents,
} from "./bracketLayout.js";
import {
  buildBracketView,
  formatUpsetChance,
  type MatchView,
  type TeamView,
} from "./bracketView.js";
import { buildPredictEntries, type PredictEntry } from "./renderPredict.js";

export type BracketHtmlFormat = "cards" | "aligned";

export interface HtmlRenderOptions {
  showSeeds?: boolean;
  format?: BracketHtmlFormat;
}

export interface PredictHtmlOptions {
  iterations?: number;
}

export interface ViewerOptions {
  mode?: "simulate" | "predict" | "both";
  format?: BracketHtmlFormat;
  iterations?: number;
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

function renderUpsetChanceHtml(probability: number | null): string {
  if (probability === null) {
    return "";
  }
  return `<span class="upset-chance">${escapeHtml(formatUpsetChance(probability))}</span>`;
}

function renderMatchCard(match: MatchView, showSeeds: boolean): string {
  const score =
    match.scoreA !== undefined && match.scoreB !== undefined
      ? `<span class="score">${match.scoreA}-${match.scoreB}</span>`
      : "";
  const upsetChance = !match.winner ? renderUpsetChanceHtml(match.upsetChance) : "";

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
    ${upsetChance}
  </article>`;
}

function renderAlignedMatchCard(
  match: MatchView,
  showSeeds: boolean,
  round: number,
  totalRounds: number
): string {
  const { top, bottom, mid } = matchExtents(round, match.slot, totalRounds);
  const topRow = displayRow(top);
  const bottomRow = displayRow(bottom);
  const midRow = displayRow(mid);
  const rowStart = round === 0 ? topRow + 1 : midRow + 1;
  const rowEnd = round === 0 ? bottomRow + 2 : midRow + 2;
  const style = `style="grid-row: ${rowStart} / ${rowEnd}"`;
  const connector =
    round < totalRounds - 1
      ? `<span class="match-connector" aria-hidden="true"></span>`
      : "";

  return `<div class="aligned-match" ${style}>
    ${renderMatchCard(match, showSeeds)}
    ${connector}
  </div>`;
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

function renderBracketCardsHtml(
  view: ReturnType<typeof buildBracketView>,
  showSeeds: boolean
): string {
  return view.matchesByRound
    .map(
      (matches, roundIndex) => `<section class="round">
        <h3>${escapeHtml(view.roundLabels[roundIndex])}</h3>
        ${matches.map((match) => renderMatchCard(match, showSeeds)).join("\n")}
      </section>`
    )
    .join("\n");
}

function renderBracketAlignedHtml(
  view: ReturnType<typeof buildBracketView>,
  showSeeds: boolean
): string {
  const firstRoundMatches = view.matchesByRound[0]?.length ?? 0;
  const rowCount = bracketGridRowCount(view.rounds, firstRoundMatches);

  return view.matchesByRound
    .map(
      (matches, roundIndex) => `<section class="round aligned-round" style="--bracket-rows: ${rowCount}">
        <h3>${escapeHtml(view.roundLabels[roundIndex])}</h3>
        <div class="aligned-round-grid">
          ${matches
            .map((match) => renderAlignedMatchCard(match, showSeeds, roundIndex, view.rounds))
            .join("\n")}
        </div>
      </section>`
    )
    .join("\n");
}

/** Render a simulated bracket as semantic HTML for the web viewer. */
export function renderBracketHtml(
  bracket: Bracket,
  options: HtmlRenderOptions = {}
): string {
  const showSeeds = options.showSeeds ?? true;
  const format = options.format ?? "aligned";
  const view = buildBracketView(bracket);
  const columns =
    format === "aligned"
      ? renderBracketAlignedHtml(view, showSeeds)
      : renderBracketCardsHtml(view, showSeeds);
  const gridClass = format === "aligned" ? "bracket-grid aligned" : "bracket-grid";

  const fieldSummary = renderFieldSummaryHtml(bracket);
  const champion = renderChampionHtml(view.champion, showSeeds);

  return `<h2 class="section-heading">Simulated bracket</h2><div class="${gridClass}">${columns}</div>${fieldSummary}${champion}`;
}

/** Render predict probabilities as HTML bars. */
export function renderPredictHtml(
  entries: PredictEntry[],
  options: PredictHtmlOptions = {}
): string {
  const iterationLabel =
    options.iterations !== undefined
      ? ` (${options.iterations.toLocaleString()} simulations)`
      : "";

  return `<h2 class="section-heading">Championship probabilities${iterationLabel}</h2><div class="predict-list">
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

function renderViewerForm(teams: string[], options: ViewerOptions = {}): string {
  const teamValue = escapeHtml(teams.join(", "));
  const format = options.format ?? "aligned";
  const iterations = options.iterations ?? 1000;

  const cardsSelected = format === "cards" ? " selected" : "";
  const alignedSelected = format === "aligned" ? " selected" : "";

  return `<form id="bracket-form">
      <label for="teams">Teams (comma-separated)</label>
      <input id="teams" name="teams" value="${teamValue}" required />
      <p class="form-hint">Use <code>Name:rating</code> for custom Elo ratings, e.g. <code>Duke:1650,Kansas:1620</code>.</p>
      <div class="form-row">
        <div class="form-field">
          <label for="format">Bracket layout</label>
          <select id="format" name="format">
            <option value="aligned"${alignedSelected}>Aligned tree</option>
            <option value="cards"${cardsSelected}>Card columns</option>
          </select>
        </div>
        <div class="form-field">
          <label for="iterations">Predict simulations</label>
          <input id="iterations" name="iterations" type="number" min="100" max="100000" step="100" value="${iterations}" />
        </div>
      </div>
      <div class="actions">
        <button type="submit" name="mode" value="simulate">Simulate</button>
        <button type="submit" name="mode" value="predict">Predict</button>
        <button type="submit" name="mode" value="both">Simulate + predict</button>
      </div>
    </form>`;
}

/** Render a full HTML page for the web viewer. */
export function renderViewerPage(
  bracketHtml: string,
  predictHtml: string,
  teams: string[],
  options: ViewerOptions = {}
): string {
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
    ${renderViewerForm(teams, options)}
    <section id="results">
      ${bracketHtml}
      ${predictHtml}
    </section>
  </main>
</body>
</html>`;
}

/** Convenience helper for server responses. */
export function renderSimulatePage(
  bracket: Bracket,
  teams: string[],
  options: ViewerOptions = {}
): string {
  return renderViewerPage(
    renderBracketHtml(bracket, { format: options.format }),
    "",
    teams,
    options
  );
}

export function renderPredictPage(
  rates: Map<string, number>,
  teams: import("../types.js").Team[],
  teamNames: string[],
  options: ViewerOptions & { iterations?: number } = {}
): string {
  const entries = buildPredictEntries(rates, teams);
  return renderViewerPage(
    "",
    renderPredictHtml(entries, { iterations: options.iterations }),
    teamNames,
    options
  );
}

export function renderCombinedPage(
  bracket: Bracket,
  rates: Map<string, number>,
  teams: import("../types.js").Team[],
  teamNames: string[],
  options: ViewerOptions = {}
): string {
  const entries = buildPredictEntries(rates, teams);
  return renderViewerPage(
    renderBracketHtml(bracket, { format: options.format }),
    renderPredictHtml(entries, { iterations: options.iterations }),
    teamNames,
    { ...options, mode: "both" }
  );
}
