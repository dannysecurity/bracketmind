import { describe, expect, it } from "vitest";
import {
  bracketSlotKey,
  bracketSlotOf,
  gameParticipantsOf,
  isWinnerTeamA,
  sameBracketSlot,
  validateGameParticipants,
  validateGameResult,
  winnerAndLoserScores,
} from "./game.js";
import { isCompletedMatch, isReadyMatch, matchBracketSlot } from "./match.js";
import {
  isByeTeam,
  teamIdsOf,
  toRuntimeTeam,
  toSeededTeam,
  type SeededTeam,
  type Team,
} from "./team.js";

const uconn: SeededTeam = {
  id: "uconn",
  name: "UConn",
  seed: 1,
  rating: 1720,
};

describe("team model conversions", () => {
  it("maps seeded fixture entries to runtime teams", () => {
    expect(toRuntimeTeam(uconn)).toEqual({
      id: "uconn",
      name: "UConn",
      seed: 1,
      rating: 1720,
    });
  });

  it("maps runtime teams with seeds back to seeded entries", () => {
    const runtime: Team = { id: "a", name: "Alpha", rating: 1600, seed: 3 };
    expect(toSeededTeam(runtime)).toEqual({
      id: "a",
      name: "Alpha",
      rating: 1600,
      seed: 3,
    });
  });

  it("returns undefined when a runtime team has no official seed", () => {
    expect(toSeededTeam({ id: "cli", name: "CLI Team", rating: 1500 })).toBeUndefined();
  });

  it("detects BYE placeholders by name", () => {
    expect(isByeTeam({ id: "bye-0", name: "BYE", rating: 0 })).toBe(true);
    expect(isByeTeam({ id: "a", name: "Alpha", rating: 1500 })).toBe(false);
    expect(isByeTeam(null)).toBe(false);
  });

  it("collects team ids from seeded entries", () => {
    expect(teamIdsOf([uconn, { id: "purdue", name: "Purdue", seed: 2, rating: 1680 }])).toEqual(
      new Set(["uconn", "purdue"])
    );
  });
});

describe("bracket slot helpers", () => {
  it("builds stable keys for round and slot pairs", () => {
    expect(bracketSlotKey({ round: 2, slot: 1 })).toBe("2:1");
  });

  it("compares bracket slots by coordinates", () => {
    const left = { round: 0, slot: 1 };
    const right = { round: 0, slot: 1 };
    const other = { round: 1, slot: 0 };

    expect(sameBracketSlot(left, right)).toBe(true);
    expect(sameBracketSlot(left, other)).toBe(false);
  });

  it("copies bracket coordinates without extra fields", () => {
    expect(bracketSlotOf({ round: 3, slot: 0 })).toEqual({ round: 3, slot: 0 });
  });

  it("extracts participant ids from recorded games", () => {
    const game = {
      round: 0,
      slot: 1,
      teamAId: "a",
      teamBId: "b",
      scoreA: 70,
      scoreB: 65,
      winnerId: "a",
    };

    expect(gameParticipantsOf(game)).toEqual({ teamAId: "a", teamBId: "b" });
  });

  it("extracts bracket coordinates from a match", () => {
    expect(
      matchBracketSlot({
        id: "m-4",
        round: 1,
        slot: 0,
        teamA: null,
        teamB: null,
        winner: null,
      })
    ).toEqual({ round: 1, slot: 0 });
  });
});

describe("game result helpers", () => {
  const participants = { teamAId: "a", teamBId: "b" };

  it("identifies when team A won", () => {
    expect(
      isWinnerTeamA({ ...participants, scoreA: 72, scoreB: 65, winnerId: "a" })
    ).toBe(true);
    expect(
      isWinnerTeamA({ ...participants, scoreA: 65, scoreB: 72, winnerId: "b" })
    ).toBe(false);
  });

  it("aligns winner and loser scores with the declared winner", () => {
    expect(
      winnerAndLoserScores({
        ...participants,
        scoreA: 72,
        scoreB: 65,
        winnerId: "a",
      })
    ).toEqual({ winnerScore: 72, loserScore: 65 });

    expect(
      winnerAndLoserScores({
        ...participants,
        scoreA: 65,
        scoreB: 72,
        winnerId: "b",
      })
    ).toEqual({ winnerScore: 72, loserScore: 65 });
  });

  it("rejects games where both sides reference the same team", () => {
    expect(() =>
      validateGameParticipants({ teamAId: "a", teamBId: "a" })
    ).toThrow(/must be different/);

    expect(() =>
      validateGameResult(
        { scoreA: 72, scoreB: 65, winnerId: "a" },
        { teamAId: "a", teamBId: "a" },
        "round 0, slot 0"
      )
    ).toThrow(/must be different.*round 0, slot 0/);
  });

  it("validates consistent scores and winner ids", () => {
    expect(() =>
      validateGameResult(
        { scoreA: 72, scoreB: 65, winnerId: "a" },
        participants
      )
    ).not.toThrow();

    expect(() =>
      validateGameResult(
        { scoreA: 65, scoreB: 72, winnerId: "a" },
        participants,
        "round 0, slot 0"
      )
    ).toThrow(/outscore.*round 0, slot 0/);

    expect(() =>
      validateGameResult(
        { scoreA: 70, scoreB: 68, winnerId: "ghost" },
        participants
      )
    ).toThrow(/must be teamA or teamB/);

    expect(() =>
      validateGameResult(
        { scoreA: -1, scoreB: 70, winnerId: "a" },
        participants
      )
    ).toThrow(/non-negative/);
  });
});

describe("match lifecycle types", () => {
  const teamA = { id: "a", name: "Alpha", rating: 1600 };
  const teamB = { id: "b", name: "Beta", rating: 1500 };

  it("narrows ready matches awaiting a result", () => {
    const pending = {
      id: "m-0",
      round: 0,
      slot: 0,
      teamA,
      teamB,
      winner: null,
    };

    expect(isReadyMatch(pending)).toBe(true);
    if (isReadyMatch(pending)) {
      expect(pending.teamA.id).toBe("a");
    }
  });

  it("narrows completed matches with scores", () => {
    const finished = {
      id: "m-0",
      round: 0,
      slot: 0,
      teamA,
      teamB,
      winner: teamA,
      scoreA: 72,
      scoreB: 65,
    };

    expect(isCompletedMatch(finished)).toBe(true);
    if (isCompletedMatch(finished)) {
      expect(finished.scoreA).toBe(72);
    }
  });
});
