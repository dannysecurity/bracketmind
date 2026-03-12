import type { SeriesSimulationResult, Team } from "../types.js";
import { ColorOptions, dim, heading, winner } from "./colors.js";
import type { GameRenderOptions } from "./renderGameResult.js";
import { roundLabel } from "./roundLabels.js";

function formatRating(team: Team): string {
  return `${team.name} (${Math.round(team.rating)})`;
}

function formatGameScore(
  teamA: Team,
  teamB: Team,
  scoreA: number,
  scoreB: number,
  gameWinner: Team,
  options: ColorOptions
): string {
  const labelA = `${teamA.name} ${scoreA}`;
  const labelB = `${teamB.name} ${scoreB}`;
  const formattedA =
    gameWinner.id === teamA.id ? winner(labelA, options) : labelA;
  const formattedB =
    gameWinner.id === teamB.id ? winner(labelB, options) : labelB;
  return `${formattedA} - ${formattedB}`;
}

/** Render a best-of-N head-to-head series with per-game scores. */
export function renderGameSeries(
  teamA: Team,
  teamB: Team,
  result: SeriesSimulationResult,
  options: GameRenderOptions = { enabled: false }
): string[] {
  const lines: string[] = [];
  lines.push(heading(`Best-of-${result.bestOf} Series`, options));
  lines.push("");
  lines.push(`  ${formatRating(teamA)} vs ${formatRating(teamB)}`);

  if (options.round !== undefined && options.totalRounds !== undefined) {
    lines.push(
      dim(
        `  Round context: ${roundLabel(options.round, options.totalRounds)}`,
        options
      )
    );
  }

  if (
    options.seedA !== undefined &&
    options.seedB !== undefined &&
    options.historicalWeight !== undefined &&
    options.historicalWeight > 0
  ) {
    const weightPct = Math.round(options.historicalWeight * 100);
    lines.push(
      dim(
        `  Seeds: #${options.seedA} vs #${options.seedB} — win chance blends historical upset rates (${weightPct}%)`,
        options
      )
    );
  }

  lines.push("");

  for (const [index, game] of result.games.entries()) {
    const scoreLine = `  Game ${index + 1}: ${formatGameScore(
      teamA,
      teamB,
      game.scoreA,
      game.scoreB,
      game.winner,
      options
    )}`;
    lines.push(scoreLine);
    if (game.isUpset) {
      lines.push(dim("           upset", options));
    }
  }

  lines.push("");
  const seriesWinnerWins =
    result.winner.id === teamA.id ? result.winsA : result.winsB;
  const seriesLoserWins =
    result.winner.id === teamA.id ? result.winsB : result.winsA;
  lines.push(
    `  Series: ${winner(result.winner.name, options)} wins ${seriesWinnerWins}-${seriesLoserWins}`
  );

  if (options.showRatingDeltas) {
    lines.push(
      `  Final ratings: ${teamA.name} ${Math.round(result.teamA.rating)}, ${teamB.name} ${Math.round(result.teamB.rating)}`
    );
  }

  return lines;
}
