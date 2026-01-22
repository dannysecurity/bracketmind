import { expectedScore } from "../ratings.js";
import { simulateGame } from "../simulator.js";
import type {
  Bracket,
  GameMonteCarloResult,
  Match,
  SimulationResult,
  Team,
} from "../types.js";

/** Build a team for simulation tests. */
export function team(name: string, rating: number, id?: string): Team {
  return { id: id ?? name.toLowerCase().replace(/\s+/g, "-"), name, rating };
}

/** Build a seeded field of `count` teams with descending ratings. */
export function ratedField(
  count: number,
  topRating = 1700,
  step = 25
): Team[] {
  return Array.from({ length: count }, (_, index) =>
    team(`S${index + 1}`, topRating - index * step)
  );
}

/** Return a deterministic RNG that cycles through the given values. */
export function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

/** Return an RNG that always yields the same value. */
export function constantRng(value: number): () => number {
  return () => value;
}

/** Wrap an RNG and track how many times it is invoked. */
export function countingRng(
  base: () => number = Math.random
): { rng: () => number; callCount: () => number } {
  let calls = 0;
  return {
    rng: () => {
      calls += 1;
      return base();
    },
    callCount: () => calls,
  };
}

/** Count matches that will actually be simulated (both sides present, neither is a BYE). */
export function nonByeMatchCount(bracket: Bracket): number {
  return bracket.matches.filter(
    (match) =>
      match.teamA &&
      match.teamB &&
      match.teamA.name !== "BYE" &&
      match.teamB.name !== "BYE"
  ).length;
}

/** RNG draws consumed by a full single-elimination simulation (three per game). */
export function expectedRngCallsForTeamCount(realTeamCount: number): number {
  return Math.max(0, realTeamCount - 1) * 3;
}

/** Win probability for team A from two ratings (Elo expected score). */
export function winProbabilityFor(ratingA: number, ratingB: number): number {
  return expectedScore(ratingA, ratingB);
}

/** Round-one pairings from a built bracket. */
export function roundOneMatches(bracket: Bracket): Match[] {
  return bracket.matches.filter((match) => match.round === 0);
}

/** Matches where one side is a BYE placeholder. */
export function byeMatches(bracket: Bracket): Match[] {
  return bracket.matches.filter(
    (match) => match.teamA?.name === "BYE" || match.teamB?.name === "BYE"
  );
}

/** All matches in a given round (0-based). */
export function matchesInRound(bracket: Bracket, round: number): Match[] {
  return bracket.matches.filter((match) => match.round === round);
}

/** The championship match (last round, slot 0). */
export function finalMatch(bracket: Bracket): Match {
  const match = bracket.matches.find(
    (entry) => entry.round === bracket.rounds - 1 && entry.slot === 0
  );
  if (!match) {
    throw new Error(`No final match found for ${bracket.rounds}-round bracket`);
  }
  return match;
}

/** BYE placeholders added when padding a field to the next power of two. */
export function expectedByeCount(teamCount: number): number {
  const target = Math.pow(2, Math.ceil(Math.log2(teamCount)));
  return target - teamCount;
}

/** Assert the recorded winner has the higher box score. */
export function assertWinnerHasHigherScore(
  result: SimulationResult,
  teamA: Team
): void {
  const winnerScore = result.winner.id === teamA.id ? result.scoreA : result.scoreB;
  const loserScore = result.winner.id === teamA.id ? result.scoreB : result.scoreA;
  if (winnerScore < loserScore) {
    throw new Error(
      `Winner ${result.winner.name} scored ${winnerScore}, loser scored ${loserScore}`
    );
  }
}

/** Non-BYE matches a team actually played (has recorded scores). */
export function playedMatchesForTeam(bracket: Bracket, teamId: string): Match[] {
  return bracket.matches.filter(
    (match) =>
      match.scoreA !== undefined &&
      (match.teamA?.id === teamId || match.teamB?.id === teamId)
  );
}

/** Manually aggregate head-to-head stats for cross-checking Monte Carlo output. */
export function computeGameOutcomeAggregates(
  teamA: Team,
  teamB: Team,
  iterations: number,
  rng: () => number
): Pick<
  GameMonteCarloResult,
  | "winRateA"
  | "winRateB"
  | "upsetRate"
  | "avgMargin"
  | "marginStdDev"
  | "marginPercentiles"
  | "avgScoreA"
  | "avgScoreB"
> {
  let winsA = 0;
  let upsets = 0;
  let marginTotal = 0;
  let scoreATotal = 0;
  let scoreBTotal = 0;
  const margins: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const result = simulateGame({ ...teamA }, { ...teamB }, { rng });
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
  const sortedMargins = [...margins].sort((a, b) => a - b);
  const percentile = (p: number) => {
    if (sortedMargins.length === 1) {
      return sortedMargins[0];
    }
    const index = (p / 100) * (sortedMargins.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) {
      return sortedMargins[lower];
    }
    const weight = index - lower;
    return sortedMargins[lower] * (1 - weight) + sortedMargins[upper] * weight;
  };
  const marginStdDev =
    margins.length <= 1
      ? 0
      : Math.sqrt(
          margins.reduce((sum, margin) => sum + (margin - avgMargin) ** 2, 0) /
            margins.length
        );

  return {
    winRateA: winsA / iterations,
    winRateB: (iterations - winsA) / iterations,
    upsetRate: upsets / iterations,
    avgMargin,
    marginStdDev,
    marginPercentiles: {
      p10: percentile(10),
      p50: percentile(50),
      p90: percentile(90),
    },
    avgScoreA: scoreATotal / iterations,
    avgScoreB: scoreBTotal / iterations,
  };
}

/** Assert every simulated non-BYE match has valid scores and a winner. */
export function assertBracketSimulationInvariants(bracket: Bracket): void {
  for (const match of bracket.matches) {
    const isBye =
      match.teamA?.name === "BYE" || match.teamB?.name === "BYE";

    if (isBye) {
      if (match.scoreA !== undefined || match.scoreB !== undefined) {
        throw new Error(`BYE match ${match.id} should not record scores`);
      }
      continue;
    }

    if (!match.winner) {
      throw new Error(`Match ${match.id} has no winner after simulation`);
    }

    if (match.scoreA === undefined || match.scoreB === undefined) {
      throw new Error(`Match ${match.id} is missing scores`);
    }

    const winnerScore =
      match.winner.id === match.teamA?.id ? match.scoreA : match.scoreB;
    const loserScore =
      match.winner.id === match.teamA?.id ? match.scoreB : match.scoreA;

    if (winnerScore <= loserScore) {
      throw new Error(`Match ${match.id} winner did not outscore the loser`);
    }
  }
}
