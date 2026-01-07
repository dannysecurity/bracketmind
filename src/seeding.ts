import { createBracket } from "./bracket.js";
import { upsetProbability } from "./ratings.js";
import type { Bracket, Team } from "./types.js";

export interface SeededTeam {
  seed: number;
  team: Team;
}

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

function buildSeedMap(teams: Team[]): Map<string, number> {
  const realTeams = teams.filter((team) => team.name !== "BYE");
  const ranked = [...realTeams].sort((a, b) => b.rating - a.rating);
  const seeds = new Map<string, number>();
  ranked.forEach((team, index) => {
    seeds.set(team.id, index + 1);
  });
  return seeds;
}

function matchupUpsetProbability(teamA: Team, teamB: Team): number | null {
  if (teamA.name === "BYE" || teamB.name === "BYE") {
    return null;
  }

  const favoriteRating = Math.max(teamA.rating, teamB.rating);
  const underdogRating = Math.min(teamA.rating, teamB.rating);
  return upsetProbability(favoriteRating, underdogRating);
}

/** Rank teams by rating and assign tournament seeds (1 = highest rated). */
export function buildSeededTeams(teams: Team[]): SeededTeam[] {
  const realTeams = teams.filter((team) => team.name !== "BYE");
  const ranked = [...realTeams].sort((a, b) => b.rating - a.rating);
  return ranked.map((team, index) => ({
    seed: index + 1,
    team,
  }));
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

/** Build seedings and round-one matchups from a raw team list. */
export function analyzeSeeding(teams: Team[]): {
  seededTeams: SeededTeam[];
  roundOneMatchups: RoundOneMatchup[];
} {
  const bracket = createBracket(teams);
  return {
    seededTeams: buildSeededTeams(teams),
    roundOneMatchups: getRoundOneMatchups(bracket),
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
