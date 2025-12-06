import type { Bracket } from "../types.js";
import { buildBracketView, type MatchView } from "./bracketView.js";
import { ColorOptions, dim, heading, winner } from "./colors.js";

export interface TreeRenderOptions extends ColorOptions {
  nameWidth?: number;
}

interface MatchExtents {
  top: number;
  bottom: number;
  mid: number;
}

function matchExtents(round: number, slot: number, totalRounds: number): MatchExtents {
  if (round === 0) {
    const top = slot * 2;
    return { top, bottom: top + 1, mid: top + 0.5 };
  }

  const upper = matchExtents(round - 1, slot * 2, totalRounds);
  const lower = matchExtents(round - 1, slot * 2 + 1, totalRounds);
  return {
    top: upper.top,
    bottom: lower.bottom,
    mid: (upper.mid + lower.mid) / 2,
  };
}

function displayRow(mid: number): number {
  return Math.round(mid * 2);
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
  return padName(label, width, options, isWinner);
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
  const nameWidth = options.nameWidth ?? 14;
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
        setLine(grid, topRow, column, formatTeamName(match, "A", nameWidth, options));
        setLine(grid, bottomRow, column, formatTeamName(match, "B", nameWidth, options));
        setLine(grid, topRow, column + nameWidth, "─┐");
        setLine(grid, bottomRow, column + nameWidth, "─┘");
        for (let row = topRow + 1; row < bottomRow; row++) {
          setLine(grid, row, column + nameWidth + 3, "│");
        }
      } else {
        const winnerText = formatWinnerName(match, nameWidth, options) + scoreSuffix(match);
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
