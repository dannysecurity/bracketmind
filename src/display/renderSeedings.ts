import { analyzeSeeding, mostLikelyUpset, type RoundOneMatchup } from "../seeding.js";
import type { Team } from "../types.js";
import { ColorOptions, dim, heading } from "./colors.js";

export interface SeedingsRenderOptions extends ColorOptions {}

function formatUpsetChance(probability: number): string {
  return `${Math.round(probability * 100)}% upset chance`;
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

/** Render seed order and round-one upset probabilities for CLI output. */
export function renderSeedingsSection(
  teams: Team[],
  options: SeedingsRenderOptions = { enabled: false }
): string[] {
  const { seededTeams, roundOneMatchups } = analyzeSeeding(teams);
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

  return lines;
}
