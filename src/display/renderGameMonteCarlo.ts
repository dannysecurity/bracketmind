import type { GameMonteCarloResult, Team } from "../types.js";
import { bar, ColorOptions, dim, heading } from "./colors.js";

export interface GameMonteCarloRenderOptions extends ColorOptions {
  barWidth?: number;
}

function renderWinRateBar(
  team: Team,
  rate: number,
  maxNameLength: number,
  barWidth: number,
  options: ColorOptions
): string {
  const filledCount = Math.max(0, Math.round(rate * barWidth));
  const filled = "█".repeat(filledCount);
  const empty = "░".repeat(barWidth - filledCount);
  const name = team.name.padEnd(maxNameLength);
  const pct = `${(rate * 100).toFixed(1)}%`.padStart(6);
  return `  ${name} ${bar(filled, empty, options)} ${pct}`;
}

/** Render aggregated head-to-head Monte Carlo statistics. */
export function renderGameMonteCarloSummary(
  teamA: Team,
  teamB: Team,
  result: GameMonteCarloResult,
  options: GameMonteCarloRenderOptions = { enabled: false }
): string[] {
  const barWidth = options.barWidth ?? 24;
  const maxNameLength = Math.max(teamA.name.length, teamB.name.length, 4);
  const lines: string[] = [];

  lines.push("");
  lines.push(
    heading(`Head-to-head forecast (${result.iterations} simulations)`, options)
  );
  lines.push("");
  lines.push(renderWinRateBar(teamA, result.winRateA, maxNameLength, barWidth, options));
  lines.push(renderWinRateBar(teamB, result.winRateB, maxNameLength, barWidth, options));
  lines.push(
    dim(
      `  Analytical win rate (${teamA.name}): ${(result.analyticalWinRateA * 100).toFixed(1)}%`,
      options
    )
  );
  lines.push(
    dim(
      `  Win rate 95% CI: ${teamA.name} ${(result.winRateConfidenceA.low * 100).toFixed(1)}–${(result.winRateConfidenceA.high * 100).toFixed(1)}%, ${teamB.name} ${(result.winRateConfidenceB.low * 100).toFixed(1)}–${(result.winRateConfidenceB.high * 100).toFixed(1)}%`,
      options
    )
  );
  lines.push(
    `  Avg score: ${teamA.name} ${result.avgScoreA.toFixed(1)}, ${teamB.name} ${result.avgScoreB.toFixed(1)}`
  );
  lines.push(
    `  Avg margin: ${result.avgMargin.toFixed(1)} pts (σ ${result.marginStdDev.toFixed(1)})`
  );
  lines.push(
    `  Margin spread (p10–p90): ${result.marginPercentiles.p10.toFixed(1)}–${result.marginPercentiles.p90.toFixed(1)} pts (median ${result.marginPercentiles.p50.toFixed(1)})`
  );
  lines.push(`  Upset rate: ${(result.upsetRate * 100).toFixed(1)}%`);

  return lines;
}
