import { resolveWinProbabilityA } from "../probability/winProbability.js";
import {
  createTournamentState,
  effectiveRating,
} from "../tournamentState.js";
import type {
  GameMonteCarloResult,
  SimulationOptions,
  SimulationResult,
  Team,
} from "../types.js";
import { simulateGame } from "./gameSimulator.js";
import { withResolvedSeeds } from "./seedContext.js";
import { summarizeMargins, wilsonScoreInterval } from "./stats.js";

const DEFAULT_RNG = Math.random;

function cloneTeam(team: Team): Team {
  return { ...team };
}

function ratingForTeam(team: Team, options: SimulationOptions): number {
  if (options.tournamentState) {
    return effectiveRating(team, options.tournamentState);
  }
  return team.rating;
}

/** Run many head-to-head simulations and aggregate win, score, and upset rates. */
export function monteCarloGameOutcomes(
  teamA: Team,
  teamB: Team,
  iterations: number,
  options: SimulationOptions = {}
): GameMonteCarloResult {
  if (iterations <= 0) {
    throw new Error("At least one iteration is required");
  }

  const rng = options.rng ?? DEFAULT_RNG;
  const resolvedOptions = withResolvedSeeds(teamA, teamB, options);
  const ratingA = ratingForTeam(teamA, resolvedOptions);
  const ratingB = ratingForTeam(teamB, resolvedOptions);
  const analyticalWinRateA = resolveWinProbabilityA(
    teamA,
    teamB,
    ratingA,
    ratingB,
    resolvedOptions
  );

  let winsA = 0;
  let upsets = 0;
  let marginTotal = 0;
  let scoreATotal = 0;
  let scoreBTotal = 0;
  const margins: number[] = [];
  let sampleResult: SimulationResult | undefined;

  for (let i = 0; i < iterations; i++) {
    const simTeamA = cloneTeam(teamA);
    const simTeamB = cloneTeam(teamB);
    const simOptions: SimulationOptions = {
      ...resolvedOptions,
      rng,
      tournamentState: resolvedOptions.tournamentState
        ? createTournamentState([simTeamA, simTeamB])
        : undefined,
    };

    const result = simulateGame(simTeamA, simTeamB, simOptions);
    if (sampleResult === undefined) {
      sampleResult = result;
    }

    if (result.winner.id === teamA.id) {
      winsA++;
    }
    if (result.isUpset) {
      upsets++;
    }
    marginTotal += result.margin;
    margins.push(result.margin);
    scoreATotal += result.scoreA;
    scoreBTotal += result.scoreB;
  }

  const avgMargin = marginTotal / iterations;
  const marginSummary = summarizeMargins(margins, avgMargin);
  const winRateConfidenceA = wilsonScoreInterval(winsA, iterations);
  const winRateConfidenceB = wilsonScoreInterval(iterations - winsA, iterations);

  return {
    iterations,
    winRateA: winsA / iterations,
    winRateB: (iterations - winsA) / iterations,
    winRateConfidenceA,
    winRateConfidenceB,
    upsetRate: upsets / iterations,
    avgMargin,
    marginStdDev: marginSummary.marginStdDev,
    marginPercentiles: marginSummary.marginPercentiles,
    avgScoreA: scoreATotal / iterations,
    avgScoreB: scoreBTotal / iterations,
    analyticalWinRateA,
    sampleResult: sampleResult!,
  };
}

/** Run many simulations and return each team's championship rate. */
export function monteCarloChampionshipRates(
  teams: Team[],
  iterations: number,
  simulateBracketFn: (teams: Team[]) => Team
): Map<string, number> {
  if (iterations <= 0) {
    throw new Error("At least one iteration is required");
  }

  const wins = new Map<string, number>();
  for (const team of teams) {
    wins.set(team.id, 0);
  }

  for (let i = 0; i < iterations; i++) {
    const champion = simulateBracketFn(teams.map((t) => ({ ...t })));
    wins.set(champion.id, (wins.get(champion.id) ?? 0) + 1);
  }

  const rates = new Map<string, number>();
  for (const [id, count] of wins) {
    rates.set(id, count / iterations);
  }
  return rates;
}
