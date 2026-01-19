import { simulateGame } from "./simulator.js";
import { createTournamentState } from "./tournamentState.js";
import { createRating } from "./ratings.js";
import { matchIndex } from "./bracket/layout.js";
import { advanceWinner } from "./domain/advanceWinner.js";
import { buildBracket } from "./domain/buildBracket.js";
import type { Bracket, BracketSimulationOptions, Team } from "./types.js";
import { isByeTeam } from "./types.js";

/** Build a single-elimination bracket from an arbitrary list of teams. */
export function createBracket(teams: Team[]): Bracket {
  return buildBracket(teams, { ordering: "rating" });
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

      if (isByeTeam(match.teamA)) {
        match.winner = match.teamB;
      } else if (isByeTeam(match.teamB)) {
        match.winner = match.teamA;
      } else {
        if (!match.teamA || !match.teamB) {
          throw new Error(`Incomplete match at round ${round}, slot ${slot}`);
        }

        const result = simulateGame(match.teamA, match.teamB, {
          rng,
          tournamentState,
          round,
          totalRounds: working.rounds,
        });
        match.winner = result.winner;
        match.scoreA = result.scoreA;
        match.scoreB = result.scoreB;
      }

      if (match.winner) {
        advanceWinner(working, round, slot, match.winner);
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

/** Parse a team name or `Name:rating` spec from the CLI. */
export function parseTeamSpec(
  spec: string,
  baseRating = 1500
): { name: string; rating: number } {
  const trimmed = spec.trim();
  const match = trimmed.match(/^(.+):(\d+)$/);
  if (match) {
    return {
      name: match[1].trim(),
      rating: createRating(parseInt(match[2], 10)),
    };
  }
  return { name: trimmed, rating: createRating(baseRating) };
}

export function parseTeams(names: string[], baseRating = 1500): Team[] {
  return names.map((spec, i) => {
    const parsed = parseTeamSpec(spec, baseRating);
    return {
      id: `team-${i}`,
      name: parsed.name,
      rating: parsed.rating,
    };
  });
}

export { renderBracket } from "./display/renderList.js";
