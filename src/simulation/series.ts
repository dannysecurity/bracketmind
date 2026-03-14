import type {
  SeriesSimulationResult,
  SimulationOptions,
  SimulationResult,
  Team,
} from "../types.js";
import { cloneTeam } from "./helpers.js";
import { simulateGame } from "./gameSimulator.js";

/**
 * Simulate a best-of-N series between two teams.
 *
 * Plays games until one team reaches the majority win threshold. When
 * `tournamentState` is provided, ratings carry forward between games.
 */
export function simulateBestOfSeries(
  teamA: Team,
  teamB: Team,
  bestOf: number,
  options: SimulationOptions = {}
): SeriesSimulationResult {
  if (!Number.isInteger(bestOf) || bestOf < 1) {
    throw new Error("bestOf must be a positive odd integer");
  }
  if (bestOf % 2 === 0) {
    throw new Error("bestOf must be odd (e.g. 1, 3, 5, 7)");
  }

  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const simTeamA = cloneTeam(teamA);
  const simTeamB = cloneTeam(teamB);
  const games: SimulationResult[] = [];
  let winsA = 0;
  let winsB = 0;

  while (winsA < winsNeeded && winsB < winsNeeded) {
    const result = simulateGame(simTeamA, simTeamB, options);
    games.push(result);

    if (result.winner.id === teamA.id) {
      winsA++;
    } else {
      winsB++;
    }
  }

  return {
    bestOf,
    winsA,
    winsB,
    winner: winsA > winsB ? simTeamA : simTeamB,
    games,
    teamA: simTeamA,
    teamB: simTeamB,
  };
}
