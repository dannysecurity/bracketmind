import { getChampion, simulateBracket } from "../bracket.js";
import { buildBracket } from "../domain/buildBracket.js";
import type { Season } from "../models/season.js";
import { monteCarloChampionshipRates } from "../simulator.js";
import type { Team } from "../types.js";
import { seasonFromDocument } from "./adapters.js";
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

function resolveSeason(doc: SeasonDocument | Season) {
  return "registry" in doc ? doc : seasonFromDocument(doc);
}

/** Compare pre-tournament Monte Carlo predictions against the actual champion. */
export function compareSeasonPredictions(
  doc: SeasonDocument | Season,
  iterations = 1000
): SeasonPredictionComparison {
  const season = resolveSeason(doc);
  const teams = season.toRuntimeTeams();
  const actualChampion = getSeasonChampion(season);
  const predictedRates = monteCarloChampionshipRates(
    teams,
    iterations,
    (field) =>
      getChampion(
        simulateBracket(buildBracket(field, { ordering: "seed" }))
      )
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
