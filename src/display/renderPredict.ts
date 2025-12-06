import type { Team } from "../types.js";
import { bar, ColorOptions, heading } from "./colors.js";

export interface PredictEntry {
  team: Team;
  rate: number;
}

export interface PredictRenderOptions extends ColorOptions {
  barWidth?: number;
}

function toPredictEntries(
  rates: Map<string, number>,
  teams: Team[]
): PredictEntry[] {
  return [...rates.entries()]
    .map(([id, rate]) => ({
      team: teams.find((team) => team.id === id)!,
      rate,
    }))
    .filter((entry) => entry.team && entry.team.name !== "BYE")
    .sort((a, b) => b.rate - a.rate);
}

/** Render championship probabilities as aligned horizontal bar chart lines. */
export function renderPredictBars(
  rates: Map<string, number>,
  teams: Team[],
  options: PredictRenderOptions = { enabled: false }
): string[] {
  const barWidth = options.barWidth ?? 24;
  const entries = toPredictEntries(rates, teams);
  const maxNameLength = Math.max(...entries.map((entry) => entry.team.name.length), 4);
  const lines: string[] = [];

  for (const entry of entries) {
    const filledCount = Math.max(0, Math.round(entry.rate * barWidth));
    const filled = "█".repeat(filledCount);
    const empty = "░".repeat(barWidth - filledCount);
    const name = entry.team.name.padEnd(maxNameLength);
    const pct = `${(entry.rate * 100).toFixed(1)}%`.padStart(6);
    lines.push(`  ${name} ${bar(filled, empty, options)} ${pct}`);
  }

  return lines;
}

/** Render a titled predict section with bar chart lines. */
export function renderPredictSection(
  rates: Map<string, number>,
  teams: Team[],
  iterations: number,
  options: PredictRenderOptions = { enabled: false }
): string[] {
  return [
    heading(`Championship probabilities (${iterations} simulations)`, options),
    "",
    ...renderPredictBars(rates, teams, options),
  ];
}

/** Build predict entries for HTML or other renderers. */
export function buildPredictEntries(
  rates: Map<string, number>,
  teams: Team[]
): PredictEntry[] {
  return toPredictEntries(rates, teams);
}
