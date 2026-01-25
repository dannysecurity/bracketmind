import {
  analyzeUpsetLandscape,
  type RoundUpsetSummary,
  type UpsetCandidate,
  type UpsetOutlookOptions,
} from "../probability/analytics.js";
import type { Team } from "../types.js";
import { ColorOptions, dim, heading } from "./colors.js";

export interface UpsetsRenderOptions extends ColorOptions, UpsetOutlookOptions {}

function formatPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

function formatSeedLabel(seed: number | null, name: string): string {
  return seed !== null ? `#${seed} ${name}` : name;
}

function formatMatchupPair(candidate: UpsetCandidate): string {
  return `${formatSeedLabel(candidate.seedA, candidate.teamA.name)} vs ${formatSeedLabel(candidate.seedB, candidate.teamB.name)}`;
}

function formatCandidateLine(candidate: UpsetCandidate): string {
  const upsetLine =
    candidate.historicalUpsetProbability !== null
      ? `${formatPercent(candidate.eloUpsetProbability)} Elo · ${formatPercent(candidate.historicalUpsetProbability)} historical · ${formatPercent(candidate.upsetProbability)} blended upset chance`
      : `${formatPercent(candidate.upsetProbability)} upset chance`;
  if (candidate.isKnownMatchup) {
    return `  ${formatMatchupPair(candidate)} — ${upsetLine}`;
  }

  return `  ${formatMatchupPair(candidate)} — ${upsetLine}, ${formatPercent(candidate.meetingProbability)} meet, ${formatPercent(candidate.upsetExpectation)} expected upset mass`;
}

function formatRoundSummary(summary: RoundUpsetSummary): string[] {
  const lines = [
    heading(summary.roundLabel, { enabled: false }),
    "",
  ];

  const playable = summary.candidates.filter(
    (candidate) => candidate.upsetProbability > 0
  );

  if (playable.length === 0) {
    lines.push("  No playable matchups");
    return lines;
  }

  const topCandidates = playable.slice(0, 3);
  for (const candidate of topCandidates) {
    lines.push(formatCandidateLine(candidate));
  }

  if (summary.averageUpsetProbability !== null) {
    lines.push(
      dim(
        `  Average upset chance: ${formatPercent(summary.averageUpsetProbability)}`,
        { enabled: false }
      )
    );
  }

  return lines;
}

/** Render tournament-wide upset probability analysis for CLI output. */
export function renderUpsetsSection(
  teams: Team[],
  options: UpsetsRenderOptions = { enabled: false }
): string[] {
  const landscape = analyzeUpsetLandscape(teams, {
    historicalWeight: options.historicalWeight,
  });
  const lines: string[] = [
    heading("Tournament Upset Landscape", options),
    "",
    dim(
      "Blends Elo upset odds with historical NCAA seed rates across every round.",
      options
    ),
    "",
  ];

  for (const summary of landscape.roundSummaries) {
    lines.push(...formatRoundSummary(summary), "");
  }

  const overall = landscape.mostLikelyUpsetOverall;
  if (overall) {
    lines.push(
      heading("Most Likely Upset", options),
      "",
      `  ${formatMatchupPair(overall)} in ${overall.roundLabel}`,
      dim(
        `  ${formatPercent(overall.upsetProbability)} upset chance${overall.isKnownMatchup ? "" : `, ${formatPercent(overall.upsetExpectation)} expected upset mass`}`,
        options
      )
    );
  }

  return lines;
}
