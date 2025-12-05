import { expectedScore } from "./ratings.js";
import type { SimulationOptions, SimulationResult, Team } from "./types.js";

const DEFAULT_RNG = Math.random;

/** Expected point margin when `winner` beats `loser`, scaled by rating gap. */
export function expectedMargin(winner: Team, loser: Team): number {
  const gap = winner.rating - loser.rating;
  const isUpset = gap < 0;
  const gapFactor = Math.abs(gap) / 40;
  const base = 5 + gapFactor * (isUpset ? 0.35 : 1);
  return Math.max(1, Math.round(base));
}

function generateScores(
  winner: Team,
  loser: Team,
  rng: () => number
): { scoreWinner: number; scoreLoser: number } {
  const margin = Math.max(
    1,
    expectedMargin(winner, loser) + Math.floor(rng() * 10 - 5)
  );
  const scoreWinner = 68 + Math.floor(rng() * 12) + Math.floor(margin / 2);
  const scoreLoser = Math.max(55, scoreWinner - margin);

  return { scoreWinner, scoreLoser };
}

/** Simulate a single game between two teams using rating-based probabilities. */
export function simulateGame(
  teamA: Team,
  teamB: Team,
  options: SimulationOptions = {}
): SimulationResult {
  const rng = options.rng ?? DEFAULT_RNG;
  const winProbabilityA = expectedScore(teamA.rating, teamB.rating);
  const roll = rng();

  const aWins = roll < winProbabilityA;
  const winner = aWins ? teamA : teamB;
  const loser = aWins ? teamB : teamA;

  const { scoreWinner, scoreLoser } = generateScores(winner, loser, rng);

  return {
    winner,
    scoreA: aWins ? scoreWinner : scoreLoser,
    scoreB: aWins ? scoreLoser : scoreWinner,
    winProbabilityA,
  };
}

/** Run many simulations and return each team's championship rate. */
export function monteCarloChampionshipRates(
  teams: Team[],
  iterations: number,
  simulateBracket: (teams: Team[]) => Team
): Map<string, number> {
  const wins = new Map<string, number>();
  for (const team of teams) {
    wins.set(team.id, 0);
  }

  for (let i = 0; i < iterations; i++) {
    const champion = simulateBracket(teams.map((t) => ({ ...t })));
    wins.set(champion.id, (wins.get(champion.id) ?? 0) + 1);
  }

  const rates = new Map<string, number>();
  for (const [id, count] of wins) {
    rates.set(id, count / iterations);
  }
  return rates;
}
