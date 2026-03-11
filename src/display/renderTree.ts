import type { Bracket } from "../types.js";
import { displayRow, matchExtents } from "./bracketLayout.js";
import { buildBracketView, type BracketView, type MatchView } from "./bracketView.js";
import { formatUpsetChance } from "./bracketView.js";
import { UPSET_LABEL } from "./matchOutcomes.js";
import { ColorOptions, dim, heading, upset, winner } from "./colors.js";

export interface TreeRenderOptions extends ColorOptions {
  nameWidth?: number;
}

function padName(name: string, width: number, options: ColorOptions, isWinner: boolean): string {
  const clipped = name.length > width ? `${name.slice(0, width - 1)}…` : name;
  const padded = clipped.padEnd(width);
  if (isWinner) {
    return winner(padded, options);
  }
  return padded;
}

function formatTeamName(match: MatchView, side: "A" | "B", width: number, options: ColorOptions): string {
  const team = side === "A" ? match.teamA : match.teamB;
  if (!team) {
    return "TBD".padEnd(width);
  }
  if (team.isBye) {
    return dim("BYE".padEnd(width), options);
  }

  const label = team.seed !== null ? `#${team.seed} ${team.name}` : team.name;
  const isWinner = Boolean(match.winner && team.name === match.winner.name);
  const padded = padName(label, width, options, isWinner);
  if (match.winner && !isWinner) {
    return dim(padded, options);
  }
  return padded;
}

function formatOpeningRoundTeam(
  match: MatchView,
  side: "A" | "B",
  width: number,
  options: ColorOptions
): string {
  const name = formatTeamName(match, side, width, options);
  if (!match.winner || match.scoreA === undefined || match.scoreB === undefined) {
    return name + (side === "B" ? formatUpsetHint(match, options) : "");
  }

  const team = side === "A" ? match.teamA : match.teamB;
  if (team && match.winner.name === team.name) {
    const upsetBadge = match.wasUpset ? upset(` ${UPSET_LABEL}`, options) : "";
    return name + scoreSuffix(match) + upsetBadge;
  }
  return name;
}

function formatUpsetHint(match: MatchView, options: ColorOptions): string {
  if (match.winner && match.wasUpset) {
    return upset(` ${UPSET_LABEL}`, options);
  }
  if (match.upsetChance === null || match.winner) {
    return "";
  }
  return dim(` (${formatUpsetChance(match.upsetChance)})`, options);
}

function computeNameWidth(view: BracketView, minWidth = 14): number {
  let maxLen = minWidth;

  for (const round of view.matchesByRound) {
    for (const match of round) {
      for (const team of [match.teamA, match.teamB, match.winner]) {
        if (!team || team.isBye) {
          continue;
        }
        const label = team.seed !== null ? `#${team.seed} ${team.name}` : team.name;
        maxLen = Math.max(maxLen, label.length);
      }
    }
  }

  return maxLen;
}

function formatWinnerName(match: MatchView, width: number, options: ColorOptions): string {
  if (!match.winner) {
    return "TBD".padEnd(width);
  }
  if (match.isByeMatch) {
    const label = match.winner.seed !== null ? `#${match.winner.seed} ${match.winner.name}` : match.winner.name;
    return padName(label, width, options, true);
  }

  const label = match.winner.seed !== null ? `#${match.winner.seed} ${match.winner.name}` : match.winner.name;
  return padName(label, width, options, true);
}

function scoreSuffix(match: MatchView): string {
  if (match.scoreA === undefined || match.scoreB === undefined) {
    return "";
  }
  return ` (${match.scoreA}-${match.scoreB})`;
}

function setLine(lines: string[], row: number, column: number, text: string): void {
  while (lines.length <= row) {
    lines.push("");
  }
  const current = lines[row] ?? "";
  if (column < current.length) {
    lines[row] = current.slice(0, column) + text + current.slice(column + text.length);
  } else {
    lines[row] = current.padEnd(column) + text;
  }
}

/** Render a bracket as an ASCII tree with rounds flowing left to right. */
export function renderBracketTree(
  bracket: Bracket,
  options: TreeRenderOptions = { enabled: false }
): string[] {
  const view = buildBracketView(bracket);
  const nameWidth = options.nameWidth ?? computeNameWidth(view);
  const connectorWidth = 4;
  const columnWidth = nameWidth + connectorWidth;
  const output: string[] = [];

  let maxRow = 0;
  for (let round = 0; round < view.rounds; round++) {
    for (const match of view.matchesByRound[round]) {
      const { mid } = matchExtents(round, match.slot, view.rounds);
      maxRow = Math.max(maxRow, displayRow(mid));
    }
  }

  const grid: string[] = Array.from({ length: maxRow + 1 }, () => "");

  for (let round = 0; round < view.rounds; round++) {
    const column = round * columnWidth;
    const matches = view.matchesByRound[round];

    for (const match of matches) {
      const { top, bottom, mid } = matchExtents(round, match.slot, view.rounds);
      const topRow = displayRow(top);
      const bottomRow = displayRow(bottom);
      const midRow = displayRow(mid);

      if (round === 0) {
        setLine(grid, topRow, column, formatOpeningRoundTeam(match, "A", nameWidth, options));
        setLine(grid, bottomRow, column, formatOpeningRoundTeam(match, "B", nameWidth, options));
        setLine(grid, topRow, column + nameWidth, "─┐");
        setLine(grid, bottomRow, column + nameWidth, "─┘");
        for (let row = topRow + 1; row < bottomRow; row++) {
          setLine(grid, row, column + nameWidth + 3, "│");
        }
      } else {
        const winnerText =
          formatWinnerName(match, nameWidth, options) +
          scoreSuffix(match) +
          formatUpsetHint(match, options);
        setLine(grid, midRow, column, winnerText);
        if (round < view.rounds - 1) {
          setLine(grid, midRow, column + nameWidth, "───┐");
          const feederTop = displayRow(matchExtents(round - 1, match.slot * 2, view.rounds).mid);
          const feederBottom = displayRow(
            matchExtents(round - 1, match.slot * 2 + 1, view.rounds).mid
          );
          const start = Math.min(feederTop, feederBottom, midRow);
          const end = Math.max(feederTop, feederBottom, midRow);
          for (let row = start; row <= end; row++) {
            if (row !== midRow) {
              setLine(grid, row, column + nameWidth + 3, "│");
            }
          }
        }
      }
    }
  }

  const header = view.roundLabels.map((label) => heading(label.padEnd(columnWidth), options)).join("");
  output.push(header.trimEnd());

  for (const line of grid) {
    if (line.trim().length > 0) {
      output.push(line.replace(/\s+$/, ""));
    }
  }

  return output;
}
