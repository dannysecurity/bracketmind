import { simulateGame } from "./simulator.js";
import { createRating } from "./ratings.js";
import type { Bracket, Match, Team } from "./types.js";

function nextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function seedTeams(teams: Team[]): Team[] {
  const target = nextPowerOfTwo(teams.length);
  const seeded = [...teams].sort((a, b) => b.rating - a.rating);

  while (seeded.length < target) {
    seeded.push({
      id: `bye-${seeded.length}`,
      name: "BYE",
      rating: 0,
    });
  }

  return seeded;
}

/** Build a single-elimination bracket from an arbitrary list of teams. */
export function createBracket(teams: Team[]): Bracket {
  if (teams.length < 2) {
    throw new Error("At least two teams are required");
  }

  const seeded = seedTeams(teams);
  const rounds = Math.log2(seeded.length);
  const matches: Match[] = [];
  let matchId = 0;

  for (let round = 0; round < rounds; round++) {
    const slots = seeded.length / Math.pow(2, round + 1);
    for (let slot = 0; slot < slots; slot++) {
      matches.push({
        id: `m-${matchId++}`,
        round,
        slot,
        teamA: round === 0 ? seeded[slot * 2] : null,
        teamB: round === 0 ? seeded[slot * 2 + 1] : null,
        winner: null,
      });
    }
  }

  return { teams: seeded, matches, rounds };
}

function matchIndex(round: number, slot: number, rounds: number): number {
  let index = 0;
  for (let r = 0; r < round; r++) {
    index += Math.pow(2, rounds - r - 1);
  }
  return index + slot;
}

/** Play every pending match in the bracket until a champion is crowned. */
export function simulateBracket(bracket: Bracket): Bracket {
  const working = structuredClone(bracket);

  for (let round = 0; round < working.rounds; round++) {
    const slots = working.teams.length / Math.pow(2, round + 1);

    for (let slot = 0; slot < slots; slot++) {
      const idx = matchIndex(round, slot, working.rounds);
      const match = working.matches[idx];

      if (match.teamA?.name === "BYE") {
        match.winner = match.teamB;
        continue;
      }
      if (match.teamB?.name === "BYE") {
        match.winner = match.teamA;
        continue;
      }

      if (!match.teamA || !match.teamB) {
        throw new Error(`Incomplete match at round ${round}, slot ${slot}`);
      }

      const result = simulateGame(match.teamA, match.teamB);
      match.winner = result.winner;
      match.scoreA = result.scoreA;
      match.scoreB = result.scoreB;

      if (round + 1 < working.rounds) {
        const nextIdx = matchIndex(round + 1, Math.floor(slot / 2), working.rounds);
        const nextMatch = working.matches[nextIdx];
        if (slot % 2 === 0) {
          nextMatch.teamA = match.winner;
        } else {
          nextMatch.teamB = match.winner;
        }
      }
    }
  }

  return working;
}

export function getChampion(bracket: Bracket): Team {
  const finalIdx = bracket.matches.length - 1;
  const winner = bracket.matches[finalIdx].winner;
  if (!winner) {
    throw new Error("Bracket has not been simulated yet");
  }
  return winner;
}

export function parseTeams(names: string[], baseRating = 1500): Team[] {
  return names.map((name, i) => ({
    id: `team-${i}`,
    name: name.trim(),
    rating: createRating(baseRating),
  }));
}

/** Render bracket lines for CLI output. */
export function renderBracket(bracket: Bracket): string[] {
  const lines: string[] = [];
  for (let round = 0; round < bracket.rounds; round++) {
    const roundMatches = bracket.matches.filter((m) => m.round === round);
    lines.push(`Round ${round + 1}`);
    for (const match of roundMatches) {
      const labelA = match.teamA?.name ?? "TBD";
      const labelB = match.teamB?.name ?? "TBD";
      if (match.winner) {
        const score =
          match.scoreA !== undefined && match.scoreB !== undefined
            ? ` (${match.scoreA}-${match.scoreB})`
            : "";
        lines.push(`  ${labelA} vs ${labelB} → ${match.winner.name}${score}`);
      } else {
        lines.push(`  ${labelA} vs ${labelB}`);
      }
    }
    lines.push("");
  }
  return lines;
}
