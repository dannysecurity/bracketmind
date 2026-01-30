import type { ColorOptions } from "./colors.js";
import { dim, heading } from "./colors.js";
import type { SeasonGameUpsetAnalysis } from "../season/analyzeUpsets.js";
import type { SeasonPredictionComparison } from "../season/comparePredictions.js";
import type { FixtureCatalogEntry } from "../season/fixtureCatalog.js";
import type { SeasonRatingDelta } from "../season/replayRatings.js";
import type { SeasonSummary } from "../season/summarizeSeason.js";
import type { SeasonDocument } from "../season/types.js";
import { roundLabel } from "./roundLabels.js";

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

export function renderSeasonValidation(
  doc: SeasonDocument,
  summary: SeasonSummary,
  color: ColorOptions = { enabled: false }
): string[] {
  const status = summary.isComplete
    ? "Complete"
    : `Partial (${summary.recordedGames}/${summary.expectedGames} games recorded)`;

  const lines = [
    heading("Historical Season Validation", color),
    `${doc.name} (${doc.year})`,
    "",
    `Status: ${status}`,
    `Teams: ${summary.teamCount} · Rounds: ${summary.totalRounds}`,
    `Rating upsets: ${summary.ratingUpsets} · Seed upsets: ${summary.seedUpsets}`,
  ];

  if (summary.championName) {
    lines.push(`Champion: ${summary.championName}`);
  }

  return lines;
}

export function renderFixtureCatalog(
  entries: FixtureCatalogEntry[],
  color: ColorOptions = { enabled: false }
): string[] {
  const lines = [
    heading("Bundled Historical Season Fixtures", color),
    "",
    dim("Use a fixture id or @id instead of a full path:", color),
    dim("  bracketmind import season @2024-south-region", color),
    "",
  ];

  for (const entry of entries) {
    const champion = entry.championName ? ` · ★ ${entry.championName}` : "";
    lines.push(
      `${entry.id} — ${entry.name} (${entry.year}) · ${entry.teamCount} teams · ${entry.gameCount} games${champion}`
    );
  }

  return lines;
}

export function renderSeasonInfo(
  doc: SeasonDocument,
  summary: SeasonSummary,
  color: ColorOptions = { enabled: false }
): string[] {
  const status = summary.isComplete
    ? "Complete"
    : `Partial (${summary.recordedGames}/${summary.expectedGames} games recorded)`;

  const lines = [
    heading("Season Fixture Info", color),
    `${doc.id} — ${doc.name} (${doc.year})`,
    "",
    `Status: ${status}`,
    `Teams: ${summary.teamCount} · Games: ${summary.recordedGames}/${summary.expectedGames} · Rounds: ${summary.totalRounds}`,
    `Rating upsets: ${summary.ratingUpsets} · Seed upsets: ${summary.seedUpsets}`,
  ];

  if (summary.championName) {
    lines.push(`Champion: ${summary.championName}`);
  }

  lines.push("");
  lines.push(dim(`Load full bracket: bracketmind import season @${doc.id}`, color));

  return lines;
}

export function renderSeasonFixtureImport(
  doc: SeasonDocument,
  summary: SeasonSummary,
  outputPath: string,
  options: { dryRun: boolean },
  color: ColorOptions = { enabled: false }
): string[] {
  const action = options.dryRun ? "Would write" : "Wrote";
  const status = summary.isComplete
    ? "Complete"
    : `Partial (${summary.recordedGames}/${summary.expectedGames} games recorded)`;

  const lines = [
    heading("Historical Season Fixture Import", color),
    `${doc.id} — ${doc.name} (${doc.year})`,
    "",
    `Status: ${status}`,
    `Teams: ${summary.teamCount} · Games: ${summary.recordedGames}/${summary.expectedGames}`,
  ];

  if (summary.championName) {
    lines.push(`Champion: ${summary.championName}`);
  }

  lines.push("");
  lines.push(`${action} fixture to ${outputPath}`);

  if (options.dryRun) {
    lines.push("");
    lines.push(
      dim("Re-run without --dry-run to write the fixture to disk.", color)
    );
  } else {
    lines.push("");
    lines.push(
      dim(`View imported bracket: bracketmind import season @${doc.id}`, color)
    );
  }

  return lines;
}

export function renderSeasonUpsetAnalysis(
  analyses: SeasonGameUpsetAnalysis[],
  totalRounds: number,
  color: ColorOptions = { enabled: false }
): string[] {
  const lines = [heading("Recorded Game Upset Analysis", color), ""];
  const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

  for (const game of analyses) {
    const label = roundLabel(game.round, totalRounds);
    const markers = [
      game.wasRatingUpset ? "rating upset" : null,
      game.wasSeedUpset ? "seed upset" : null,
    ]
      .filter(Boolean)
      .join(", ");
    const suffix = markers ? ` (${markers})` : "";

    lines.push(
      `${label} · ${game.teamA.name} vs ${game.teamB.name}: ${game.scoreA}-${game.scoreB}, ${game.winner.name} wins`
    );
    lines.push(
      dim(
        `  Pre-game lower-rated win chance: ${pct(game.preGameUpsetProbability)}${suffix}`,
        color
      )
    );
    lines.push("");
  }

  return lines;
}
