import { createBracket, getChampion, simulateBracket } from "../bracket.js";
import { monteCarloChampionshipRates } from "../simulator.js";
import type { Team } from "../types.js";
import { teamsFromDocument } from "./adapters.js";
import { getSeasonChampion } from "./hydrateResults.js";
import type { SeasonDocument } from "./types.js";

export interface SeasonPredictionComparison {
  actualChampion: Team;
  predictedRates: Map<string, number>;
  iterations: number;
  actualChampionPredictedRate: number;
  mostFavoredTeam: Team;
  mostFavoredRate: number;
}

/** Compare pre-tournament Monte Carlo predictions against the actual champion. */
export function compareSeasonPredictions(
  doc: SeasonDocument,
  iterations = 1000
): SeasonPredictionComparison {
  const teams = teamsFromDocument(doc);
  const actualChampion = getSeasonChampion(doc);
  const predictedRates = monteCarloChampionshipRates(
    teams,
    iterations,
    (field) => getChampion(simulateBracket(createBracket(field)))
  );

  let mostFavoredTeam = teams[0];
  let mostFavoredRate = predictedRates.get(teams[0].id) ?? 0;

  for (const team of teams) {
    const rate = predictedRates.get(team.id) ?? 0;
    if (rate > mostFavoredRate) {
      mostFavoredRate = rate;
      mostFavoredTeam = team;
    }
  }

  return {
    actualChampion,
    predictedRates,
    iterations,
    actualChampionPredictedRate: predictedRates.get(actualChampion.id) ?? 0,
    mostFavoredTeam,
    mostFavoredRate,
  };
}
