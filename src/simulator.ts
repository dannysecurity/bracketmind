import { expectedScore } from "./ratings.js";
import type { SimulationResult, Team } from "./types.js";

/** Simulate a single game between two teams using rating-based probabilities. */
export function simulateGame(teamA: Team, teamB: Team): SimulationResult {
  const winProbabilityA = expectedScore(teamA.rating, teamB.rating);
  const roll = Math.random();

  const aWins = roll < winProbabilityA;
  const winner = aWins ? teamA : teamB;
  const loser = aWins ? teamB : teamA;

  const margin = 1 + Math.floor(Math.random() * 20);
  const scoreWinner = 70 + margin + Math.floor(Math.random() * 15);
  const scoreLoser = Math.max(55, scoreWinner - margin - Math.floor(Math.random() * 10));

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
