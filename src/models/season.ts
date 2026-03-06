import {
  bracketGeometryForTeamCount,
  validateRecordedGames,
} from "./gameValidation.js";
import { GameCatalog } from "./gameCatalog.js";
import type { RecordedGame } from "./game.js";
import { TeamRegistry } from "./registry.js";
import type { SeededTeam, Team } from "./team.js";
import { teamIdsOf } from "./team.js";
import { validateSeededTeams } from "./teamValidation.js";

/** Metadata and indexed team/game collections for a tournament season. */
export class Season {
  readonly id: string;
  readonly name: string;
  readonly year: number;
  readonly registry: TeamRegistry;
  readonly catalog: GameCatalog;
  private readonly seededTeams: readonly SeededTeam[];

  private constructor(
    id: string,
    name: string,
    year: number,
    registry: TeamRegistry,
    catalog: GameCatalog,
    seededTeams: readonly SeededTeam[]
  ) {
    this.id = id;
    this.name = name;
    this.year = year;
    this.registry = registry;
    this.catalog = catalog;
    this.seededTeams = seededTeams;
  }

  /** Build a season from a document, validating teams and recorded games. */
  static fromDocument(doc: {
    id: string;
    name: string;
    year: number;
    teams: readonly SeededTeam[];
    games: readonly RecordedGame[];
  }): Season {
    validateSeededTeams(doc.teams);
    validateRecordedGames(doc.games, teamIdsOf(doc.teams), doc.teams.length);
    const registry = TeamRegistry.fromSeededTeams(doc.teams);
    const catalog = GameCatalog.fromGames(doc.games);

    return new Season(
      doc.id,
      doc.name,
      doc.year,
      registry,
      catalog,
      doc.teams
    );
  }

  get teams(): readonly SeededTeam[] {
    return this.seededTeams;
  }

  get games(): readonly RecordedGame[] {
    return this.catalog.all;
  }

  get teamCount(): number {
    return this.seededTeams.length;
  }

  get totalRounds(): number {
    return bracketGeometryForTeamCount(this.teamCount).rounds;
  }

  /** Single-elimination games required for a full bracket. */
  get expectedGames(): number {
    return this.teamCount - 1;
  }

  get recordedGames(): number {
    return this.catalog.size;
  }

  /** Runtime teams for simulation and bracket construction. */
  toRuntimeTeams(): Team[] {
    return this.registry.toArray();
  }

  /** Serialize back to a plain season document. */
  toDocument(): {
    id: string;
    name: string;
    year: number;
    teams: SeededTeam[];
    games: RecordedGame[];
  } {
    return {
      id: this.id,
      name: this.name,
      year: this.year,
      teams: [...this.seededTeams],
      games: [...this.catalog.all],
    };
  }
}
