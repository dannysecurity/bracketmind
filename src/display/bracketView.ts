import { upsetProbability } from "../ratings.js";
import type { Bracket, Match, Team } from "../types.js";

export interface TeamView {
  name: string;
  seed: number | null;
  rating: number;
  isBye: boolean;
}

export interface MatchView {
  round: number;
  slot: number;
  roundLabel: string;
  teamA: TeamView | null;
  teamB: TeamView | null;
  winner: TeamView | null;
  scoreA?: number;
  scoreB?: number;
  isByeMatch: boolean;
  /** Pre-game probability the lower-rated team wins; null for BYE or incomplete matchups. */
  upsetChance: number | null;
}

export interface BracketView {
  rounds: number;
  roundLabels: string[];
  matchesByRound: MatchView[][];
  champion: TeamView | null;
}

/** Format a team for display, optionally including its tournament seed. */
export function formatTeamLabel(
  team: TeamView | null,
  showSeeds = true
): string {
  if (!team) {
    return "TBD";
  }
  if (team.isBye) {
    return "BYE";
  }
  if (showSeeds && team.seed !== null) {
    return `#${team.seed} ${team.name}`;
  }
  return team.name;
}

const ROUND_NAMES: Record<number, string> = {
  1: "Final",
  2: "Semifinals",
  3: "Quarterfinals",
  4: "Round of 16",
  5: "Round of 32",
};

export function roundLabel(round: number, totalRounds: number): string {
  const roundsFromFinal = totalRounds - round;
  return ROUND_NAMES[roundsFromFinal] ?? `Round ${round + 1}`;
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

function toTeamView(team: Team | null, seeds: Map<string, number>): TeamView | null {
  if (!team) {
    return null;
  }

  return {
    name: team.name,
    seed: team.name === "BYE" ? null : (seeds.get(team.id) ?? null),
    rating: team.rating,
    isBye: team.name === "BYE",
  };
}

function preGameUpsetChance(
  teamA: Team | null,
  teamB: Team | null
): number | null {
  if (!teamA || !teamB || teamA.name === "BYE" || teamB.name === "BYE") {
    return null;
  }

  const favoriteRating = Math.max(teamA.rating, teamB.rating);
  const underdogRating = Math.min(teamA.rating, teamB.rating);
  return upsetProbability(favoriteRating, underdogRating);
}

function toMatchView(match: Match, seeds: Map<string, number>, totalRounds: number): MatchView {
  const teamA = toTeamView(match.teamA, seeds);
  const teamB = toTeamView(match.teamB, seeds);
  const winner = toTeamView(match.winner, seeds);

  return {
    round: match.round,
    slot: match.slot,
    roundLabel: roundLabel(match.round, totalRounds),
    teamA,
    teamB,
    winner,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    isByeMatch: Boolean(
      (teamA?.isBye && teamB && !teamB.isBye) || (teamB?.isBye && teamA && !teamA.isBye)
    ),
    upsetChance: preGameUpsetChance(match.teamA, match.teamB),
  };
}

/** Build a format-neutral view model for bracket display renderers. */
export function buildBracketView(bracket: Bracket): BracketView {
  const seeds = buildSeedMap(bracket.teams);
  const matchesByRound: MatchView[][] = [];

  for (let round = 0; round < bracket.rounds; round++) {
    const roundMatches = bracket.matches
      .filter((match) => match.round === round)
      .sort((a, b) => a.slot - b.slot)
      .map((match) => toMatchView(match, seeds, bracket.rounds));
    matchesByRound.push(roundMatches);
  }

  let champion: TeamView | null = null;
  if (bracket.rounds > 0) {
    const finalMatch = matchesByRound[bracket.rounds - 1]?.[0];
    champion = finalMatch?.winner ?? null;
  }

  return {
    rounds: bracket.rounds,
    roundLabels: matchesByRound.map((matches) => matches[0]?.roundLabel ?? ""),
    matchesByRound,
    champion,
  };
}
