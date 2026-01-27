import { createBracket } from "./bracket.js";
import { buildSeedMap, buildSeededTeams } from "./probability/seeds.js";
import type { SeededTeam } from "./probability/seeds.js";
import {
  analyzeRoundOneUpsetOutlook,
  forecastMatchupUpset,
  type TournamentUpsetOutlook,
  type UpsetOutlookOptions,
} from "./probability/seedUpsets.js";
import type { Bracket, Team } from "./types.js";

export type { SeededTeam };

export interface RoundOneMatchup {
  slot: number;
  teamA: Team;
  teamB: Team;
  seedA: number | null;
  seedB: number | null;
  /** Blended upset probability for the lower-rated team; null for BYE matchups. */
  upsetProbability: number | null;
  eloUpsetProbability: number | null;
  historicalUpsetProbability: number | null;
  isByeMatch: boolean;
}

/** Return round-one pairings with blended pre-game upset probabilities. */
export function getRoundOneMatchups(
  bracket: Bracket,
  options: UpsetOutlookOptions = {}
): RoundOneMatchup[] {
  const historicalWeight = options.historicalWeight;
  const seeds = buildSeedMap(bracket.teams);

  return bracket.matches
    .filter((match) => match.round === 0)
    .sort((a, b) => a.slot - b.slot)
    .map((match) => {
      const teamA = match.teamA!;
      const teamB = match.teamB!;
      const isByeMatch = teamA.name === "BYE" || teamB.name === "BYE";
      const seedA = teamA.name === "BYE" ? null : (seeds.get(teamA.id) ?? null);
      const seedB = teamB.name === "BYE" ? null : (seeds.get(teamB.id) ?? null);

      if (isByeMatch) {
        return {
          slot: match.slot,
          teamA,
          teamB,
          seedA,
          seedB,
          upsetProbability: null,
          eloUpsetProbability: null,
          historicalUpsetProbability: null,
          isByeMatch,
        };
      }

      const forecast = forecastMatchupUpset(
        teamA,
        teamB,
        seedA,
        seedB,
        historicalWeight,
        0
      );

      return {
        slot: match.slot,
        teamA,
        teamB,
        seedA,
        seedB,
        upsetProbability: forecast.upsetProbability,
        eloUpsetProbability: forecast.eloUpsetProbability,
        historicalUpsetProbability: forecast.historicalUpsetProbability,
        isByeMatch: false,
      };
    });
}

export type { TournamentUpsetOutlook, UpsetOutlookOptions };

/** Build seedings, round-one matchups, and blended upset outlook from a raw team list. */
export function analyzeSeeding(
  teams: Team[],
  options: UpsetOutlookOptions = {}
): {
  seededTeams: SeededTeam[];
  roundOneMatchups: RoundOneMatchup[];
  upsetOutlook: TournamentUpsetOutlook;
} {
  const bracket = createBracket(teams);
  return {
    seededTeams: buildSeededTeams(teams),
    roundOneMatchups: getRoundOneMatchups(bracket, options),
    upsetOutlook: analyzeRoundOneUpsetOutlook(bracket, options),
  };
}

/** Pick the round-one matchup with the highest upset probability, if any. */
export function mostLikelyUpset(
  matchups: RoundOneMatchup[]
): RoundOneMatchup | null {
  const contenders = matchups.filter(
    (matchup) => matchup.upsetProbability !== null
  );
  if (contenders.length === 0) {
    return null;
  }

  return contenders.reduce((best, current) =>
    current.upsetProbability! > best.upsetProbability! ? current : best
  );
}

export { buildSeededTeams };
