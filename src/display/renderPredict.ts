import { buildSeedMap } from "../probability/seeds.js";
import type { Team } from "../types.js";
import { bar, ColorOptions, heading } from "./colors.js";

export interface PredictEntry {
  team: Team;
  seed: number;
  rate: number;
}

export interface PredictRenderOptions extends ColorOptions {
  barWidth?: number;
  showSeeds?: boolean;
}

function formatPredictLabel(entry: PredictEntry, showSeeds: boolean): string {
  if (showSeeds) {
    return `#${entry.seed} ${entry.team.name}`;
  }
  return entry.team.name;
}

function toPredictEntries(
  rates: Map<string, number>,
  teams: Team[]
): PredictEntry[] {
  const seeds = buildSeedMap(teams);

  return [...rates.entries()]
    .map(([id, rate]) => {
      const team = teams.find((candidate) => candidate.id === id)!;
      return {
        team,
        seed: seeds.get(id) ?? 0,
        rate,
      };
    })
    .filter((entry) => entry.team && entry.team.name !== "BYE")
    .sort((a, b) => b.rate - a.rate || a.seed - b.seed);
}

/** Render championship probabilities as aligned horizontal bar chart lines. */
export function renderPredictBars(
  rates: Map<string, number>,
  teams: Team[],
  options: PredictRenderOptions = { enabled: false }
): string[] {
  const barWidth = options.barWidth ?? 24;
  const showSeeds = options.showSeeds ?? true;
  const entries = toPredictEntries(rates, teams);
  const maxNameLength = Math.max(
    ...entries.map((entry) => formatPredictLabel(entry, showSeeds).length),
    4
  );
  const lines: string[] = [];

  for (const entry of entries) {
    const filledCount = Math.max(0, Math.round(entry.rate * barWidth));
    const filled = "█".repeat(filledCount);
    const empty = "░".repeat(barWidth - filledCount);
    const name = formatPredictLabel(entry, showSeeds).padEnd(maxNameLength);
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
