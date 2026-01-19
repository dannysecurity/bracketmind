import { describe, expect, it } from "vitest";
import { advanceWinner } from "./advanceWinner.js";
import { buildBracket } from "./buildBracket.js";
import {
  applyGameResultToMatch,
  gameResultFromMatch,
  gameResultFromRecordedGame,
  recordedGameFromMatch,
  resolveWinner,
} from "./gameResults.js";
import { orderTeamsForBracket, seasonTeamToTeam } from "./teams.js";
import type { Match, Team } from "../types.js";

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

describe("orderTeamsForBracket", () => {
  const field = [
    team("houston", "Houston", 1705, 1),
    team("texas", "Texas", 1650, 2),
    team("xavier", "Xavier", 1595, 3),
    team("purdue", "Purdue", 1680, 4),
  ];

  it("orders by rating when requested", () => {
    expect(orderTeamsForBracket(field, "rating").map((t) => t.id)).toEqual([
      "houston",
      "purdue",
      "texas",
      "xavier",
    ]);
  });

  it("orders by official seed when requested", () => {
    expect(orderTeamsForBracket(field, "seed").map((t) => t.id)).toEqual([
      "houston",
      "texas",
      "xavier",
      "purdue",
    ]);
  });
});

describe("buildBracket", () => {
  const field = [
    team("houston", "Houston", 1705, 1),
    team("texas", "Texas", 1650, 2),
    team("xavier", "Xavier", 1595, 3),
    team("purdue", "Purdue", 1680, 4),
  ];

  it("places round-one pairings by rating by default", () => {
    const bracket = buildBracket(field);
    const roundZero = bracket.matches.filter((entry) => entry.round === 0);

    expect(roundZero[0].teamA?.id).toBe("houston");
    expect(roundZero[0].teamB?.id).toBe("xavier");
    expect(roundZero[1].teamA?.id).toBe("purdue");
    expect(roundZero[1].teamB?.id).toBe("texas");
  });

  it("places round-one pairings by official seed when configured", () => {
    const bracket = buildBracket(field, { ordering: "seed" });
    const roundZero = bracket.matches.filter((entry) => entry.round === 0);

    expect(roundZero[0].teamA?.id).toBe("houston");
    expect(roundZero[0].teamB?.id).toBe("purdue");
    expect(roundZero[1].teamA?.id).toBe("texas");
    expect(roundZero[1].teamB?.id).toBe("xavier");
  });
});

describe("gameResults", () => {
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

describe("advanceWinner", () => {
  it("writes the winner into the next-round slot", () => {
    const teams = [
      team("a", "A", 1600),
      team("b", "B", 1500),
      team("c", "C", 1400),
      team("d", "D", 1300),
    ];
    const bracket = buildBracket(teams);
    const roundZeroWinner = bracket.matches[0].teamA!;

    advanceWinner(bracket, 0, 0, roundZeroWinner);

    expect(bracket.matches[2].teamA).toBe(roundZeroWinner);
    expect(bracket.matches[2].teamB).toBeNull();
  });
});

describe("seasonTeamToTeam", () => {
  it("maps fixture entries into runtime teams with official seeds", () => {
    expect(
      seasonTeamToTeam({
        id: "uconn",
        name: "UConn",
        seed: 1,
        rating: 1720,
      })
    ).toEqual({
      id: "uconn",
      name: "UConn",
      seed: 1,
      rating: 1720,
    });
  });
});
