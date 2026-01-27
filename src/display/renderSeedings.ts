import {
  analyzeSeeding,
  mostLikelyUpset,
  type RoundOneMatchup,
} from "../seeding.js";
import type { RoundOneUpsetOutlook } from "../probability/seedUpsets.js";
import type { UpsetOutlookOptions } from "../probability/seedUpsets.js";
import type { Team } from "../types.js";
import { ColorOptions, dim, heading } from "./colors.js";

export interface SeedingsRenderOptions extends ColorOptions, UpsetOutlookOptions {}

function formatPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

function formatUpsetChance(probability: number): string {
  return `${formatPercent(probability)} upset chance`;
}

function formatSeedLabel(seed: number | null, name: string): string {
  return seed !== null ? `#${seed} ${name}` : name;
}

function formatMatchupLine(matchup: RoundOneMatchup): string {
  if (matchup.isByeMatch) {
    const advancing =
      matchup.teamA.name === "BYE" ? matchup.teamB : matchup.teamA;
    const seed = matchup.teamA.name === "BYE" ? matchup.seedB : matchup.seedA;
    return `  ${formatSeedLabel(seed, advancing.name)} advances (BYE)`;
  }

  const labelA = formatSeedLabel(matchup.seedA, matchup.teamA.name);
  const labelB = formatSeedLabel(matchup.seedB, matchup.teamB.name);
  const upsetHint =
    matchup.upsetProbability !== null
      ? ` — ${formatUpsetChance(matchup.upsetProbability)}`
      : "";

  return `  ${labelA} vs ${labelB}${upsetHint}`;
}

function formatOutlookLine(matchup: RoundOneUpsetOutlook): string {
  if (matchup.isByeMatch) {
    const advancing =
      matchup.teamA.name === "BYE" ? matchup.teamB : matchup.teamA;
    const seed = matchup.teamA.name === "BYE" ? matchup.seedB : matchup.seedA;
    return `  ${formatSeedLabel(seed, advancing.name)} advances (BYE)`;
  }

  if (matchup.blendedUpsetProbability === null) {
    return formatMatchupLine({
      ...matchup,
      upsetProbability: null,
      eloUpsetProbability: null,
      historicalUpsetProbability: null,
    });
  }

  const labelA = formatSeedLabel(matchup.seedA, matchup.teamA.name);
  const labelB = formatSeedLabel(matchup.seedB, matchup.teamB.name);
  return `  ${labelA} vs ${labelB} — ${formatPercent(matchup.eloUpsetProbability!)} Elo · ${formatPercent(matchup.historicalUpsetProbability!)} historical · ${formatPercent(matchup.blendedUpsetProbability)} blended`;
}

/** Render seed order, round-one upset probabilities, and blended upset outlook for CLI output. */
export function renderSeedingsSection(
  teams: Team[],
  options: SeedingsRenderOptions = { enabled: false }
): string[] {
  const { seededTeams, roundOneMatchups, upsetOutlook } = analyzeSeeding(teams, {
    historicalWeight: options.historicalWeight,
  });
  const lines: string[] = [heading("Bracket Seedings", options), ""];

  for (const entry of seededTeams) {
    lines.push(`  #${entry.seed} ${entry.team.name} (${entry.team.rating})`);
  }

  lines.push("", heading("Round 1 Matchups", options), "");
  for (const matchup of roundOneMatchups) {
    lines.push(formatMatchupLine(matchup));
  }

  const upset = mostLikelyUpset(roundOneMatchups);
  if (upset && upset.upsetProbability !== null) {
    lines.push(
      "",
      dim(
        `Most likely first-round upset: ${formatSeedLabel(upset.seedA, upset.teamA.name)} vs ${formatSeedLabel(upset.seedB, upset.teamB.name)} (${formatUpsetChance(upset.upsetProbability)})`,
        options
      )
    );
  }

  lines.push(
    "",
    heading("Round 1 Upset Outlook", options),
    "",
    dim(
      "Blends Elo upset odds with historical NCAA seed matchup rates.",
      options
    ),
    ""
  );
  for (const matchup of upsetOutlook.matchups) {
    lines.push(formatOutlookLine(matchup));
  }

  lines.push(
    "",
    dim(
      `Expected first-round upsets: ${upsetOutlook.expectedRoundOneUpsets.toFixed(2)}`,
      options
    )
  );

  if (upsetOutlook.mostLikelyUpset?.blendedUpsetProbability !== null) {
    const top = upsetOutlook.mostLikelyUpset!;
    lines.push(
      dim(
        `Top blended upset: ${formatSeedLabel(top.seedA, top.teamA.name)} vs ${formatSeedLabel(top.seedB, top.teamB.name)} (${formatPercent(top.blendedUpsetProbability!)} blended)`,
        options
      )
    );
  }

  return lines;
}
