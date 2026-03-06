import type { BracketSlot, RecordedGame } from "./game.js";
import { bracketSlotKey, isWinnerTeamA } from "./game.js";
import type { TeamRegistry } from "./registry.js";
import type { Team, TeamId } from "./team.js";

/** Sort key for bracket traversal: round ascending, then slot ascending. */
export function compareBracketSlots(a: BracketSlot, b: BracketSlot): number {
  return a.round === b.round ? a.slot - b.slot : a.round - b.round;
}

/** Return games ordered for bracket hydration and rating replay. */
export function sortGamesBySlot<T extends BracketSlot>(games: readonly T[]): T[] {
  return [...games].sort(compareBracketSlots);
}

export interface ResolvedGameParticipants {
  teamA: Team;
  teamB: Team;
  winner: Team;
}

export interface GameOutcomeFacts extends ResolvedGameParticipants {
  winnerIsA: boolean;
  loserId: TeamId;
  winnerSeed: number;
  loserSeed: number;
}

/** Resolve team objects and upset-related seed facts for a recorded game. */
export function resolveGameOutcome(
  game: RecordedGame,
  registry: TeamRegistry
): GameOutcomeFacts {
  const teamA = registry.require(game.teamAId);
  const teamB = registry.require(game.teamBId);
  const winner = registry.require(game.winnerId);
  const winnerIsA = isWinnerTeamA(game);
  const loserId = winnerIsA ? game.teamBId : game.teamAId;

  return {
    teamA,
    teamB,
    winner,
    winnerIsA,
    loserId,
    winnerSeed: registry.requireSeed(game.winnerId),
    loserSeed: registry.requireSeed(loserId),
  };
}

/**
 * Indexed collection of recorded games keyed by bracket slot.
 * Replaces repeated sort-and-find patterns across the season pipeline.
 */
export class GameCatalog {
  private readonly games: RecordedGame[];
  private readonly bySlot: Map<string, RecordedGame>;

  private constructor(games: RecordedGame[], bySlot: Map<string, RecordedGame>) {
    this.games = games;
    this.bySlot = bySlot;
  }

  static fromGames(games: readonly RecordedGame[]): GameCatalog {
    const sorted = sortGamesBySlot(games);
    const bySlot = new Map<string, RecordedGame>();

    for (const game of sorted) {
      const key = bracketSlotKey(game);
      if (bySlot.has(key)) {
        throw new Error(
          `Duplicate game at round ${game.round}, slot ${game.slot}`
        );
      }
      bySlot.set(key, game);
    }

    return new GameCatalog(sorted, bySlot);
  }

  get all(): readonly RecordedGame[] {
    return this.games;
  }

  get size(): number {
    return this.games.length;
  }

  getAt(round: number, slot: number): RecordedGame | undefined {
    return this.bySlot.get(bracketSlotKey({ round, slot }));
  }

  requireAt(round: number, slot: number): RecordedGame {
    const game = this.getAt(round, slot);
    if (!game) {
      throw new Error(`No game at round ${round}, slot ${slot}`);
    }
    return game;
  }

  resolveParticipants(
    game: RecordedGame,
    registry: TeamRegistry
  ): ResolvedGameParticipants {
    return {
      teamA: registry.require(game.teamAId),
      teamB: registry.require(game.teamBId),
      winner: registry.require(game.winnerId),
    };
  }
}
