import { matchIndex } from "../bracket/layout.js";
import { advanceWinner } from "../domain/advanceWinner.js";
import { simulateGame } from "../simulator.js";
import { createTournamentState } from "../tournamentState.js";
import { withPriorGamesPlayed } from "../models/teamRating.js";
import type {
  Bracket,
  BracketSimulationOptions,
  Team,
  TournamentState,
} from "../types.js";
import { isByeTeam } from "../types.js";
import { playedMatchesForTeam } from "./simulationFixtures.js";

/** Field sizes that stress single-elimination padding and round boundaries. */
export const STRESS_FIELD_SIZES = [5, 17, 31, 33, 65, 100, 127, 128] as const;

/** Total bracket rounds for a field padded to the next power of two. */
export function bracketRoundsForTeamCount(teamCount: number): number {
  const slots = Math.pow(2, Math.ceil(Math.log2(Math.max(2, teamCount))));
  return Math.log2(slots);
}

/** Non-BYE games a champion must play in a completed power-of-two bracket. */
export function expectedChampionGameCount(teamCount: number): number {
  return bracketRoundsForTeamCount(teamCount);
}

/** Clear one or both participants from a match slot (for incomplete-match tests). */
export function clearMatchSide(
  bracket: Bracket,
  round: number,
  slot: number,
  side: "teamA" | "teamB" | "both"
): void {
  const idx = matchIndex(round, slot, bracket.rounds);
  const match = bracket.matches[idx];
  if (side === "teamA" || side === "both") {
    match.teamA = null;
  }
  if (side === "teamB" || side === "both") {
    match.teamB = null;
  }
}

/** Read games-played from live tournament state after dynamic simulation. */
export function gamesPlayedFromState(
  state: TournamentState,
  teamId: string
): number {
  return state.ratings.get(teamId)?.gamesPlayed ?? 0;
}

/** Count scored non-BYE appearances for a team in a finished bracket. */
export function scoredGamesForTeam(bracket: Bracket, teamId: string): number {
  return playedMatchesForTeam(bracket, teamId).length;
}

/**
 * Assert internal games-played counters match recorded box scores.
 * Catches drift between tournament state bookkeeping and match results.
 */
export function assertGamesPlayedAlignsWithScoredMatches(
  bracket: Bracket,
  state: TournamentState
): void {
  for (const entry of bracket.teams) {
    if (entry.name === "BYE") {
      continue;
    }

    const fromState = gamesPlayedFromState(state, entry.id);
    const fromScores = scoredGamesForTeam(bracket, entry.id);
    if (fromState !== fromScores) {
      throw new Error(
        `Team ${entry.id}: gamesPlayed=${fromState} but scored matches=${fromScores}`
      );
    }
  }
}

/** Find the lowest-rated team that exits in round zero (first-round loser). */
export function firstRoundLoser(bracket: Bracket): Team | undefined {
  const roundZero = bracket.matches.filter(
    (match) =>
      match.round === 0 &&
      match.scoreA !== undefined &&
      match.teamA?.name !== "BYE" &&
      match.teamB?.name !== "BYE"
  );

  for (const match of roundZero) {
    const loser =
      match.winner?.id === match.teamA?.id ? match.teamB : match.teamA;
    if (loser && loser.name !== "BYE") {
      return loser;
    }
  }

  return undefined;
}

/**
 * Simulate bracket rounds `[fromRound, throughRound]` inclusive.
 * Used by boundary tests to seed partial brackets before corrupting later slots.
 */
export function simulateBracketThroughRound(
  bracket: Bracket,
  throughRound: number,
  options: BracketSimulationOptions = {}
): Bracket {
  const working = structuredClone(bracket);
  const rng = options.rng;
  const tournamentState = options.dynamicRatings
    ? createTournamentState(working.teams)
    : undefined;

  if (tournamentState && options.priorGamesPlayed) {
    const model = options.ratingModel;
    for (const [teamId, gamesPlayed] of options.priorGamesPlayed) {
      const entry = tournamentState.ratings.get(teamId);
      if (entry) {
        tournamentState.ratings.set(
          teamId,
          withPriorGamesPlayed(entry, gamesPlayed, model)
        );
      }
    }
  }

  const endRound = Math.min(throughRound, working.rounds - 1);

  for (let round = 0; round <= endRound; round++) {
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
          ratingModel: options.ratingModel,
          historicalWeight: options.historicalWeight,
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

  if (tournamentState && options.onTournamentState) {
    options.onTournamentState(tournamentState);
  }

  return working;
}

/** Resume simulation from `fromRound` through the championship. */
export function simulateBracketFromRound(
  bracket: Bracket,
  fromRound: number,
  options: BracketSimulationOptions = {}
): Bracket {
  const working = structuredClone(bracket);
  const rng = options.rng;
  const tournamentState = options.dynamicRatings
    ? createTournamentState(working.teams)
    : undefined;

  if (tournamentState && options.priorGamesPlayed) {
    const model = options.ratingModel;
    for (const [teamId, gamesPlayed] of options.priorGamesPlayed) {
      const entry = tournamentState.ratings.get(teamId);
      if (entry) {
        tournamentState.ratings.set(
          teamId,
          withPriorGamesPlayed(entry, gamesPlayed, model)
        );
      }
    }
  }

  for (let round = fromRound; round < working.rounds; round++) {
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
          ratingModel: options.ratingModel,
          historicalWeight: options.historicalWeight,
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

  if (tournamentState && options.onTournamentState) {
    options.onTournamentState(tournamentState);
  }

  return working;
}
