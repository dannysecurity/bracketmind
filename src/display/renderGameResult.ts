import type { SimulationResult, Team } from "../types.js";
import { ColorOptions, dim, heading, winner } from "./colors.js";

export interface GameRenderOptions extends ColorOptions {
  showRatingDeltas?: boolean;
}

function formatRating(team: Team): string {
  return `${team.name} (${Math.round(team.rating)})`;
}

function formatWinChance(team: Team, probability: number): string {
  return `${team.name} ${Math.round(probability * 100)}%`;
}

export function renderGameResult(
  teamA: Team,
  teamB: Team,
  result: SimulationResult,
  options: GameRenderOptions = { enabled: false }
): string[] {
  const lines: string[] = [];
  lines.push(heading("Game Simulation", options));
  lines.push("");
  lines.push(`  ${formatRating(teamA)} vs ${formatRating(teamB)}`);

  const scoreLine = `  → ${formatScoreTeam(teamA, result.scoreA, result.winner, options)} - ${formatScoreTeam(teamB, result.scoreB, result.winner, options)}`;
  lines.push(scoreLine);

  const favorite =
    result.winProbabilityA >= 0.5
      ? formatWinChance(teamA, result.winProbabilityA)
      : formatWinChance(teamB, 1 - result.winProbabilityA);
  lines.push(dim(`  Pre-game favorite: ${favorite}`, options));

  if (result.isUpset) {
    lines.push(dim("  Result: upset", options));
  }

  if (
    options.showRatingDeltas &&
    result.ratingDeltaA !== undefined &&
    result.ratingDeltaB !== undefined
  ) {
    const deltaA = formatDelta(result.ratingDeltaA);
    const deltaB = formatDelta(result.ratingDeltaB);
    lines.push(`  Rating change: ${teamA.name} ${deltaA}, ${teamB.name} ${deltaB}`);
  }

  return lines;
}

function formatDelta(delta: number): string {
  const rounded = Math.round(delta);
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

function formatScoreTeam(
  team: Team,
  score: number,
  gameWinner: Team,
  options: ColorOptions
): string {
  const label = `${team.name} ${score}`;
  return team.id === gameWinner.id ? winner(label, options) : label;
}
