import { describe, expect, it } from "vitest";
import { buildBracket } from "../domain/buildBracket.js";
import { simulateBracket } from "../bracket.js";
import {
  applyGameResultToMatch,
  gameResultFromMatch,
  gameResultFromRecordedGame,
  isCompletedMatch,
  recordedGameFromMatch,
  recordedGamesFromBracket,
  resolveWinner,
} from "./bracketGame.js";
import { GameCatalog } from "./gameCatalog.js";
import type { Match } from "./match.js";
import type { Team } from "./team.js";

function team(id: string, name: string, rating: number, seed?: number): Team {
  return { id, name, rating, seed };
}

function finishedMatch(
  round: number,
  slot: number,
  teamA: Team,
  teamB: Team,
  winner: Team,
  scores: { scoreA: number; scoreB: number }
): Match {
  return {
    id: `m-${round}-${slot}`,
    round,
    slot,
    teamA,
    teamB,
    winner,
    scoreA: scores.scoreA,
    scoreB: scores.scoreB,
  };
}

describe("isCompletedMatch", () => {
  const teamA = team("a", "Alpha", 1600);
  const teamB = team("b", "Beta", 1500);

  it("returns true only when teams, scores, and winner are all present", () => {
    const finished = finishedMatch(0, 0, teamA, teamB, teamA, {
      scoreA: 70,
      scoreB: 65,
    });
    expect(isCompletedMatch(finished)).toBe(true);

    const pending: Match = {
      id: "m-pending",
      round: 0,
      slot: 1,
      teamA,
      teamB,
      winner: null,
    };
    expect(isCompletedMatch(pending)).toBe(false);
  });
});

describe("bracket game conversions", () => {
  const teamA = team("a", "Alpha", 1600);
  const teamB = team("b", "Beta", 1500);

  it("converts between match state and recorded game shapes", () => {
    const finished = finishedMatch(0, 1, teamA, teamB, teamA, {
      scoreA: 72,
      scoreB: 65,
    });

    const recorded = recordedGameFromMatch(finished)!;
    expect(recorded).toEqual({
      round: 0,
      slot: 1,
      teamAId: "a",
      teamBId: "b",
      scoreA: 72,
      scoreB: 65,
      winnerId: "a",
    });

    expect(gameResultFromRecordedGame(recorded)).toEqual({
      scoreA: 72,
      scoreB: 65,
      winnerId: "a",
    });
    expect(gameResultFromMatch(finished)).toEqual(gameResultFromRecordedGame(recorded));
  });

  it("applies a game result to a match and resolves the winner object", () => {
    const pending: Match = {
      id: "m-0",
      round: 0,
      slot: 0,
      teamA,
      teamB,
      winner: null,
    };
    const winner = applyGameResultToMatch(pending, teamA, teamB, {
      scoreA: 80,
      scoreB: 70,
      winnerId: "a",
    });

    expect(winner).toBe(teamA);
    expect(pending.scoreA).toBe(80);
    expect(pending.winner?.id).toBe("a");
    expect(resolveWinner(teamA, teamB, "b")).toBe(teamB);
  });

  it("rejects winner ids that do not match either participant", () => {
    expect(() => resolveWinner(teamA, teamB, "ghost")).toThrow(/does not match/);
  });
});

describe("recordedGamesFromBracket", () => {
  it("exports simulated bracket matches as a reloadable game catalog", () => {
    const teams = [
      team("a", "A", 1700),
      team("b", "B", 1600),
      team("c", "C", 1500),
      team("d", "D", 1400),
    ];
    const simulated = simulateBracket(buildBracket(teams), { rng: () => 0.5 });
    const recorded = recordedGamesFromBracket(simulated.matches);

    expect(recorded).toHaveLength(3);
    expect(GameCatalog.fromGames(recorded).size).toBe(3);

    for (const game of recorded) {
      expect(game.winnerId).toMatch(/^[a-d]$/);
      expect([game.teamAId, game.teamBId]).toContain(game.winnerId);
    }
  });
});
