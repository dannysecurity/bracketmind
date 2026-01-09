import type { ColorOptions } from "./colors.js";
import { dim, heading } from "./colors.js";
import type { SeasonPredictionComparison } from "../season/comparePredictions.js";
import type { SeasonRatingDelta } from "../season/replayRatings.js";
import type { SeasonDocument } from "../season/types.js";

export function renderSeasonHeader(
  doc: SeasonDocument,
  color: ColorOptions = { enabled: false }
): string[] {
  return [
    heading("Historical Season Import", color),
    `${doc.name} (${doc.year})`,
    `${doc.teams.length} teams · ${doc.games.length} recorded games`,
    "",
  ];
}

export function renderSeasonRatingReplay(
  deltas: SeasonRatingDelta[],
  color: ColorOptions = { enabled: false }
): string[] {
  const lines = [heading("Post-Tournament Rating Changes", color), ""];

  for (const entry of deltas) {
    const sign = entry.delta >= 0 ? "+" : "";
    lines.push(
      `${entry.team.name}: ${Math.round(entry.startRating)} → ${Math.round(entry.endRating)} (${sign}${Math.round(entry.delta)})`
    );
  }

  return lines;
}

export function renderSeasonPredictionComparison(
  comparison: SeasonPredictionComparison,
  doc: SeasonDocument,
  color: ColorOptions = { enabled: false }
): string[] {
  const nameById = new Map(doc.teams.map((team) => [team.id, team.name]));
  const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

  const lines = [
    heading("Predictions vs Actual", color),
    "",
    `Actual champion: ${comparison.actualChampion.name}`,
    `Pre-tournament favorite: ${comparison.mostFavoredTeam.name} (${pct(comparison.mostFavoredRate)})`,
    `Actual champion pre-tournament odds: ${pct(comparison.actualChampionPredictedRate)}`,
    `Monte Carlo iterations: ${comparison.iterations}`,
    "",
    dim("Pre-tournament championship probabilities:", color),
  ];

  const sorted = [...comparison.predictedRates.entries()].sort(
    (a, b) => b[1] - a[1]
  );

  for (const [teamId, rate] of sorted) {
    const name = nameById.get(teamId) ?? teamId;
    const marker = teamId === comparison.actualChampion.id ? " ★" : "";
    lines.push(`  ${name}${marker}: ${pct(rate)}`);
  }

  return lines;
}
