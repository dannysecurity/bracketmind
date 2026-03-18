import {
  computeTournamentUpsetIndex,
  type SeedLineExposure,
  type TournamentUpsetIndex,
  type UpsetOutlookOptions,
} from "../probability/upsetIndex.js";
import type { Team } from "../types.js";
import { ColorOptions, dim, heading } from "./colors.js";

export interface UpsetIndexRenderOptions extends ColorOptions, UpsetOutlookOptions {}

function formatPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

function formatSeedLine(line: SeedLineExposure): string {
  const roundOne =
    line.roundOneUpsetChance !== null
      ? `, ${formatPercent(line.roundOneUpsetChance)} round-one upset chance`
      : "";
  return `  #${line.seed} ${line.teamName} — ${line.underdogExposure.toFixed(2)} upset exposure${roundOne}`;
}

function formatRoundExposure(index: TournamentUpsetIndex): string[] {
  const lines: string[] = [];

  for (const round of index.roundExposures) {
    lines.push(
      `  ${round.roundLabel}: ${round.expectedUpsets.toFixed(2)} expected upsets`
    );
    if (round.topCandidate) {
      const top = round.topCandidate;
      lines.push(
        dim(
          `    Top catalyst: #${top.seedA} ${top.teamA.name} vs #${top.seedB} ${top.teamB.name} (${formatPercent(top.upsetExpectation)} expected upset mass)`,
          { enabled: false }
        )
      );
    }
  }

  return lines;
}

/** Render tournament chalk index, expected upsets, and seed-line volatility for CLI output. */
export function renderUpsetIndexSection(
  teams: Team[],
  options: UpsetIndexRenderOptions = { enabled: false }
): string[] {
  const index = computeTournamentUpsetIndex(teams, {
    historicalWeight: options.historicalWeight,
  });
  const lines: string[] = [
    heading("Tournament Upset Index", options),
    "",
    `  Chalk index: ${index.chalkIndex}/100`,
    `  Expected total upsets: ${index.expectedTotalUpsets.toFixed(2)}`,
    `  Expected first-round upsets: ${index.roundOneOutlook.expectedRoundOneUpsets.toFixed(2)}`,
    "",
    heading("Round-by-Round Exposure", options),
    "",
    ...formatRoundExposure(index),
  ];

  if (index.mostVolatileSeedLine) {
    const volatile = index.mostVolatileSeedLine;
    lines.push(
      "",
      dim(
        `Most volatile seed line: #${volatile.seed} ${volatile.teamName}`,
        options
      )
    );
  }

  lines.push("", heading("Seed-Line Vulnerability", options), "");
  for (const line of index.seedLineExposures) {
    lines.push(formatSeedLine(line));
  }

  const topOverall = index.landscape.mostLikelyUpsetOverall;
  if (topOverall) {
    lines.push(
      "",
      dim(
        `Top overall upset catalyst: ${topOverall.roundLabel} — #${topOverall.seedA} ${topOverall.teamA.name} vs #${topOverall.seedB} ${topOverall.teamB.name} (${formatPercent(topOverall.upsetExpectation)} expected upset mass)`,
        options
      )
    );
  }

  return lines;
}
