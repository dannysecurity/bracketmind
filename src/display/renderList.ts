import type { Bracket } from "../types.js";
import { isByeTeam } from "../types.js";
import {
  buildBracketView,
  formatTeamLabel,
  formatUpsetChance,
  type MatchView,
  type TeamView,
} from "./bracketView.js";
import { UPSET_LABEL } from "./matchOutcomes.js";
import { ColorOptions, dim, heading, upset, winner } from "./colors.js";

export interface ListRenderOptions extends ColorOptions {
  showSeeds?: boolean;
}

function formatTeamWithOutcome(
  team: TeamView | null,
  match: MatchView,
  showSeeds: boolean,
  options: ListRenderOptions
): string {
  const label = formatTeamLabel(team, showSeeds);
  if (!match.winner || !team || team.isBye) {
    return label;
  }
  if (match.winner.name === team.name) {
    return winner(label, options);
  }
  return dim(label, options);
}

function formatMatchLine(match: MatchView, options: ListRenderOptions): string {
  const showSeeds = options.showSeeds ?? true;

  if (match.isByeMatch && match.winner) {
    const advancing = formatTeamLabel(match.winner, showSeeds);
    return `  ${advancing} advances (BYE)`;
  }

  if (match.winner) {
    const labelA = formatTeamWithOutcome(match.teamA, match, showSeeds, options);
    const labelB = formatTeamWithOutcome(match.teamB, match, showSeeds, options);
    const winnerLabel = formatTeamLabel(match.winner, showSeeds);
    const score =
      match.scoreA !== undefined && match.scoreB !== undefined
        ? ` (${match.scoreA}-${match.scoreB})`
        : "";
    const upsetBadge = match.wasUpset
      ? upset(` ${UPSET_LABEL}`, options)
      : "";
    return `  ${labelA} vs ${labelB} → ${winner(winnerLabel, options)}${score}${upsetBadge}`;
  }

  const upsetHint =
    match.upsetChance !== null ? ` (${formatUpsetChance(match.upsetChance)})` : "";
  return `  ${formatTeamLabel(match.teamA, showSeeds)} vs ${formatTeamLabel(match.teamB, showSeeds)}${upsetHint}`;
}

/** Render a bracket as a round-grouped list for CLI output. */
export function renderBracketList(
  bracket: Bracket,
  options: ListRenderOptions = { enabled: false }
): string[] {
  const view = buildBracketView(bracket);
  const lines: string[] = [];

  for (const [roundIndex, matches] of view.matchesByRound.entries()) {
    lines.push(heading(view.roundLabels[roundIndex], options));
    for (const match of matches) {
      lines.push(formatMatchLine(match, options));
    }
    lines.push("");
  }

  return lines;
}

/** Backward-compatible alias used by earlier bracket exports. */
export function renderBracket(
  bracket: Bracket,
  options: ListRenderOptions = { enabled: false }
): string[] {
  return renderBracketList(bracket, options);
}

/** Render a one-line champion summary. */
export function renderChampionLine(
  bracket: Bracket,
  options: ColorOptions = { enabled: false }
): string {
  const view = buildBracketView(bracket);
  if (!view.champion) {
    return "Champion: TBD";
  }

  const label =
    view.champion.seed !== null
      ? `#${view.champion.seed} ${view.champion.name}`
      : view.champion.name;
  return `Champion: ${winner(label, options)}`;
}

/** Dimmed footer for BYE slots in the field. */
export function renderFieldSummary(
  bracket: Bracket,
  options: ColorOptions = { enabled: false }
): string | null {
  const byeCount = bracket.teams.filter(isByeTeam).length;
  if (byeCount === 0) {
    return null;
  }
  return dim(`${byeCount} BYE slot${byeCount === 1 ? "" : "s"} in the field`, options);
}
