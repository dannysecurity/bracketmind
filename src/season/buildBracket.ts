import type { Bracket, Match, Team } from "../types.js";
import type { SeasonDocument, SeasonTeam } from "./types.js";

function nextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/** Standard single-elimination slot order (1 vs n, n/2 vs n/2+1, …). */
function bracketPlacementOrder(size: number): number[] {
  if (size === 1) {
    return [0];
  }
  const half = bracketPlacementOrder(size / 2);
  const order: number[] = [];
  for (const slot of half) {
    order.push(slot);
    order.push(size - 1 - slot);
  }
  return order;
}

function toTeam(entry: SeasonTeam): Team {
  return {
    id: entry.id,
    name: entry.name,
    rating: entry.rating,
  };
}

function padWithByes(teams: Team[], target: number): Team[] {
  const padded = [...teams];
  while (padded.length < target) {
    padded.push({
      id: `bye-${padded.length}`,
      name: "BYE",
      rating: 0,
    });
  }
  return padded;
}

/** Build an empty bracket from a season document using official seeds for placement. */
export function createBracketFromSeason(doc: SeasonDocument): Bracket {
  const sortedBySeed = [...doc.teams].sort((a, b) => a.seed - b.seed);
  const teams = sortedBySeed.map(toTeam);
  const target = nextPowerOfTwo(teams.length);
  const seeded = padWithByes(teams, target);
  const placed = bracketPlacementOrder(seeded.length).map((index) => seeded[index]);
  const rounds = Math.log2(placed.length);
  const matches: Match[] = [];
  let matchId = 0;

  for (let round = 0; round < rounds; round++) {
    const slots = placed.length / Math.pow(2, round + 1);
    for (let slot = 0; slot < slots; slot++) {
      matches.push({
        id: `m-${matchId++}`,
        round,
        slot,
        teamA: round === 0 ? placed[slot * 2] : null,
        teamB: round === 0 ? placed[slot * 2 + 1] : null,
        winner: null,
      });
    }
  }

  return { teams: placed, matches, rounds };
}

export function matchIndex(round: number, slot: number, rounds: number): number {
  let index = 0;
  for (let r = 0; r < round; r++) {
    index += Math.pow(2, rounds - r - 1);
  }
  return index + slot;
}
