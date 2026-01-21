import { createBracket } from "./bracket.js";
import { matchupUpsetProbability } from "./probability/matchup.js";
import { buildSeedMap, buildSeededTeams } from "./probability/seeds.js";
import type { SeededTeam } from "./probability/seeds.js";
import {
  analyzeRoundOneUpsetOutlook,
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
  /** Probability the lower-rated team wins; null for BYE matchups. */
  upsetProbability: number | null;
  isByeMatch: boolean;
}

/** Return round-one pairings with pre-game upset probabilities. */
export function getRoundOneMatchups(bracket: Bracket): RoundOneMatchup[] {
  const seeds = buildSeedMap(bracket.teams);

  return bracket.matches
    .filter((match) => match.round === 0)
    .sort((a, b) => a.slot - b.slot)
    .map((match) => {
      const teamA = match.teamA!;
      const teamB = match.teamB!;
      const isByeMatch = teamA.name === "BYE" || teamB.name === "BYE";

      return {
        slot: match.slot,
        teamA,
        teamB,
        seedA: teamA.name === "BYE" ? null : (seeds.get(teamA.id) ?? null),
        seedB: teamB.name === "BYE" ? null : (seeds.get(teamB.id) ?? null),
        upsetProbability: isByeMatch
          ? null
          : matchupUpsetProbability(teamA, teamB),
        isByeMatch,
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
    roundOneMatchups: getRoundOneMatchups(bracket),
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
