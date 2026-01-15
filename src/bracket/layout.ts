import type { Match, Team } from "../types.js";

export function nextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/** Standard single-elimination slot order (1 vs n, n/2 vs n/2+1, …). */
export function bracketPlacementOrder(size: number): number[] {
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

/** Map round/slot coordinates to the flat `matches` array index. */
export function matchIndex(round: number, slot: number, rounds: number): number {
  let index = 0;
  for (let r = 0; r < round; r++) {
    index += Math.pow(2, rounds - r - 1);
  }
  return index + slot;
}

export function createByeTeam(index: number): Team {
  return {
    id: `bye-${index}`,
    name: "BYE",
    rating: 0,
  };
}

export function padTeamsWithByes(teams: Team[]): Team[] {
  const target = nextPowerOfTwo(teams.length);
  const padded = [...teams];
  while (padded.length < target) {
    padded.push(createByeTeam(padded.length));
  }
  return padded;
}

/** Build empty round-zero match slots for a placed team list. */
export function buildInitialMatches(placed: Team[], rounds: number): Match[] {
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

  return matches;
}
