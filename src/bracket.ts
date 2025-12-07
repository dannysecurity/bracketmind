import { simulateGame } from "./simulator.js";
import { createTournamentState } from "./tournamentState.js";
import { createRating } from "./ratings.js";
import type { Bracket, BracketSimulationOptions, Match, Team } from "./types.js";

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
  const placed = bracketPlacementOrder(seeded.length).map((i) => seeded[i]);
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

function matchIndex(round: number, slot: number, rounds: number): number {
  let index = 0;
  for (let r = 0; r < round; r++) {
    index += Math.pow(2, rounds - r - 1);
  }
  return index + slot;
}

/** Play every pending match in the bracket until a champion is crowned. */
export function simulateBracket(
  bracket: Bracket,
  options: BracketSimulationOptions = {}
): Bracket {
  const working = structuredClone(bracket);
  const rng = options.rng;
  const tournamentState = options.dynamicRatings
    ? createTournamentState(working.teams)
    : undefined;

  for (let round = 0; round < working.rounds; round++) {
    const slots = working.teams.length / Math.pow(2, round + 1);

    for (let slot = 0; slot < slots; slot++) {
      const idx = matchIndex(round, slot, working.rounds);
      const match = working.matches[idx];

      if (match.teamA?.name === "BYE") {
        match.winner = match.teamB;
      } else if (match.teamB?.name === "BYE") {
        match.winner = match.teamA;
      } else {
        if (!match.teamA || !match.teamB) {
          throw new Error(`Incomplete match at round ${round}, slot ${slot}`);
        }

        const result = simulateGame(match.teamA, match.teamB, {
          rng,
          tournamentState,
        });
        match.winner = result.winner;
        match.scoreA = result.scoreA;
        match.scoreB = result.scoreB;
      }

      if (match.winner && round + 1 < working.rounds) {
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

export { renderBracket } from "./display/renderList.js";
