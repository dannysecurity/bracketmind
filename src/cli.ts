import {
  createBracket,
  getChampion,
  parseTeamSpec,
  parseTeams,
  simulateBracket,
} from "./bracket.js";
import {
  createSeededRng,
  createTournamentState,
  monteCarloChampionshipRates,
  simulateGame,
} from "./simulator.js";
import { startServer } from "./server.js";
import {
  renderBracketList,
  renderChampionLine,
  renderFieldSummary,
} from "./display/renderList.js";
import { renderBracketTree } from "./display/renderTree.js";
import { renderGameResult } from "./display/renderGameResult.js";
import { renderPredictSection } from "./display/renderPredict.js";
import {
  renderSeasonHeader,
  renderSeasonPredictionComparison,
  renderSeasonRatingReplay,
} from "./display/renderSeason.js";
import { renderSeedingsSection } from "./display/renderSeedings.js";
import { renderUpsetsSection } from "./display/renderUpsets.js";
import {
  compareSeasonPredictions,
  loadSeasonBracket,
  parseSeasonFile,
  replaySeasonRatings,
} from "./season/index.js";
import type { ColorOptions } from "./display/colors.js";

export type BracketFormat = "list" | "tree";

export interface SimulateOptions {
  format?: BracketFormat;
  color?: ColorOptions;
}

function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function parseSimulateArgs(args: string[]): {
  names: string[];
  format: BracketFormat;
  color: ColorOptions;
  dynamicRatings: boolean;
} {
  const formatFlag = args.indexOf("--format");
  const formatValue = formatFlag >= 0 ? args[formatFlag + 1] : "list";
  const format: BracketFormat = formatValue === "tree" ? "tree" : "list";
  const noColor = args.includes("--no-color");
  const dynamicRatings = args.includes("--dynamic-ratings");
  const filtered = args.filter(
    (value, index) =>
      value !== "--format" &&
      index !== formatFlag + 1 &&
      value !== "--no-color" &&
      value !== "--dynamic-ratings"
  );

  return {
    names: filtered.slice(1),
    format,
    color: { enabled: !noColor && supportsColor() },
    dynamicRatings,
  };
}

function parsePredictArgs(args: string[]): {
  names: string[];
  iterations: number;
  color: ColorOptions;
  dynamicRatings: boolean;
} {
  const iterationsFlag = args.indexOf("--iterations");
  const iterations =
    iterationsFlag >= 0 ? parseInt(args[iterationsFlag + 1], 10) : 1000;
  const noColor = args.includes("--no-color");
  const dynamicRatings = args.includes("--dynamic-ratings");
  const names = args
    .filter(
      (value, index) =>
        value !== "--iterations" &&
        index !== iterationsFlag + 1 &&
        value !== "--no-color" &&
        value !== "--dynamic-ratings"
    )
    .slice(1);

  return {
    names,
    iterations,
    color: { enabled: !noColor && supportsColor() },
    dynamicRatings,
  };
}

function parseSeedingsArgs(args: string[]): {
  names: string[];
  color: ColorOptions;
} {
  const noColor = args.includes("--no-color");
  const names = args.filter((value) => value !== "--no-color").slice(1);

  return {
    names,
    color: { enabled: !noColor && supportsColor() },
  };
}

function parseUpsetsArgs(args: string[]): {
  names: string[];
  color: ColorOptions;
} {
  const noColor = args.includes("--no-color");
  const names = args.filter((value) => value !== "--no-color").slice(1);

  return {
    names,
    color: { enabled: !noColor && supportsColor() },
  };
}

function parseServeArgs(args: string[]): number {
  const portFlag = args.indexOf("--port");
  const port = portFlag >= 0 ? parseInt(args[portFlag + 1], 10) : 3000;
  return Number.isNaN(port) ? 3000 : port;
}

function parseImportArgs(args: string[]): {
  subcommand: string;
  path?: string;
  format: BracketFormat;
  iterations: number;
  color: ColorOptions;
} {
  const subcommand = args[1] ?? "";
  const formatFlag = args.indexOf("--format");
  const formatValue = formatFlag >= 0 ? args[formatFlag + 1] : "list";
  const format: BracketFormat = formatValue === "tree" ? "tree" : "list";
  const iterationsFlag = args.indexOf("--iterations");
  const iterations =
    iterationsFlag >= 0 ? parseInt(args[iterationsFlag + 1], 10) : 1000;
  const noColor = args.includes("--no-color");
  const filtered = args.filter(
    (value, index) =>
      value !== "--format" &&
      (formatFlag < 0 || index !== formatFlag + 1) &&
      value !== "--iterations" &&
      (iterationsFlag < 0 || index !== iterationsFlag + 1) &&
      value !== "--no-color"
  );

  return {
    subcommand,
    path: filtered[2],
    format,
    iterations: Number.isNaN(iterations) ? 1000 : iterations,
    color: { enabled: !noColor && supportsColor() },
  };
}

function parseGameArgs(args: string[]): {
  teamSpecs: string[];
  color: ColorOptions;
  dynamicRatings: boolean;
  seed?: number;
} {
  const seedFlag = args.indexOf("--seed");
  const seedValue = seedFlag >= 0 ? parseInt(args[seedFlag + 1], 10) : undefined;
  const noColor = args.includes("--no-color");
  const dynamicRatings = args.includes("--dynamic-ratings");
  const teamSpecs = args
    .filter(
      (value, index) =>
        value !== "--seed" &&
        (seedFlag < 0 || index !== seedFlag + 1) &&
        value !== "--no-color" &&
        value !== "--dynamic-ratings"
    )
    .slice(1);

  return {
    teamSpecs,
    color: { enabled: !noColor && supportsColor() },
    dynamicRatings,
    seed: seedValue !== undefined && !Number.isNaN(seedValue) ? seedValue : undefined,
  };
}

export function runCli(args: string[]): void {
  const command = args[0] ?? "help";

  switch (command) {
    case "simulate": {
      const { names, format, color, dynamicRatings } = parseSimulateArgs(args);
      if (names.length < 2) {
        console.error(
          "Usage: bracketmind simulate <team1> <team2> [...] [--format list|tree] [--dynamic-ratings] [--no-color]"
        );
        process.exit(1);
      }

      const teams = parseTeams(names);
      const bracket = createBracket(teams);
      const result = simulateBracket(bracket, { dynamicRatings });

      console.log("Tournament Bracket Simulation\n");
      const lines =
        format === "tree"
          ? renderBracketTree(result, color)
          : renderBracketList(result, color);
      for (const line of lines) {
        console.log(line);
      }

      const fieldSummary = renderFieldSummary(result, color);
      if (fieldSummary) {
        console.log(fieldSummary);
      }

      console.log(renderChampionLine(result, color));
      break;
    }

    case "predict": {
      const { names, iterations, color, dynamicRatings } = parsePredictArgs(args);
      if (names.length < 2 || Number.isNaN(iterations)) {
        console.error(
          "Usage: bracketmind predict <team1> <team2> [...] [--iterations N] [--dynamic-ratings] [--no-color]"
        );
        process.exit(1);
      }

      const teams = parseTeams(names);
      const rates = monteCarloChampionshipRates(
        teams,
        iterations,
        (field) =>
          getChampion(
            simulateBracket(createBracket(field), { dynamicRatings })
          )
      );

      for (const line of renderPredictSection(rates, teams, iterations, color)) {
        console.log(line);
      }
      break;
    }

    case "game": {
      const { teamSpecs, color, dynamicRatings, seed } = parseGameArgs(args);
      if (teamSpecs.length !== 2) {
        console.error(
          "Usage: bracketmind game <team1> <team2> [--seed N] [--dynamic-ratings] [--no-color]"
        );
        process.exit(1);
      }

      const teamA = {
        id: "team-a",
        ...parseTeamSpec(teamSpecs[0]),
      };
      const teamB = {
        id: "team-b",
        ...parseTeamSpec(teamSpecs[1]),
      };
      const tournamentState = dynamicRatings
        ? createTournamentState([teamA, teamB])
        : undefined;
      const rng = seed !== undefined ? createSeededRng(seed) : undefined;

      const result = simulateGame(teamA, teamB, {
        rng,
        tournamentState,
      });

      for (const line of renderGameResult(teamA, teamB, result, {
        ...color,
        showRatingDeltas: dynamicRatings,
      })) {
        console.log(line);
      }
      break;
    }

    case "seedings": {
      const { names, color } = parseSeedingsArgs(args);
      if (names.length < 2) {
        console.error(
          "Usage: bracketmind seedings <team1> <team2> [...] [--no-color]"
        );
        process.exit(1);
      }

      const teams = parseTeams(names);
      for (const line of renderSeedingsSection(teams, color)) {
        console.log(line);
      }
      break;
    }

    case "upsets": {
      const { names, color } = parseUpsetsArgs(args);
      if (names.length < 2) {
        console.error(
          "Usage: bracketmind upsets <team1> <team2> [...] [--no-color]"
        );
        process.exit(1);
      }

      const teams = parseTeams(names);
      for (const line of renderUpsetsSection(teams, color)) {
        console.log(line);
      }
      break;
    }

    case "serve": {
      const port = parseServeArgs(args);
      startServer(port);
      break;
    }

    case "import": {
      const { subcommand, path, format, iterations, color } = parseImportArgs(args);

      if (!path) {
        console.error(
          "Usage: bracketmind import <season|ratings|compare> <path.json> [--format list|tree] [--iterations N] [--no-color]"
        );
        process.exit(1);
      }

      let doc;
      try {
        doc = parseSeasonFile(path);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load season fixture: ${message}`);
        process.exit(1);
      }

      switch (subcommand) {
        case "season": {
          const bracket = loadSeasonBracket(doc);
          for (const line of renderSeasonHeader(doc, color)) {
            console.log(line);
          }
          const lines =
            format === "tree"
              ? renderBracketTree(bracket, color)
              : renderBracketList(bracket, color);
          for (const line of lines) {
            console.log(line);
          }
          const fieldSummary = renderFieldSummary(bracket, color);
          if (fieldSummary) {
            console.log(fieldSummary);
          }
          console.log(renderChampionLine(bracket, color));
          break;
        }

        case "ratings": {
          const { deltas } = replaySeasonRatings(doc);
          for (const line of renderSeasonHeader(doc, color)) {
            console.log(line);
          }
          for (const line of renderSeasonRatingReplay(deltas, color)) {
            console.log(line);
          }
          break;
        }

        case "compare": {
          const comparison = compareSeasonPredictions(doc, iterations);
          for (const line of renderSeasonHeader(doc, color)) {
            console.log(line);
          }
          for (const line of renderSeasonPredictionComparison(comparison, doc, color)) {
            console.log(line);
          }
          break;
        }

        default:
          console.error(
            "Usage: bracketmind import <season|ratings|compare> <path.json> [--format list|tree] [--iterations N] [--no-color]"
          );
          process.exit(1);
      }
      break;
    }

    case "help":
    default:
      console.log(`bracketmind — tournament bracket simulator

Commands:
  game <team1> <team2> [--seed N] [--dynamic-ratings] [--no-color]
                                   Simulate a single head-to-head game
  simulate <teams...> [--format list|tree] [--dynamic-ratings] [--no-color]
                                   Run a single bracket simulation
  predict <teams...> [--iterations N] [--dynamic-ratings] [--no-color]
                                   Estimate championship odds via Monte Carlo
  seedings <teams...> [--no-color]
                                   Show rating-based seeds and round 1 upset odds
  upsets <teams...> [--no-color]
                                   Analyze upset probabilities for every round
  import season <path.json> [--format list|tree] [--no-color]
                                   Load a historical season fixture and display results
  import ratings <path.json> [--no-color]
                                   Replay recorded games and show post-tournament Elo shifts
  import compare <path.json> [--iterations N] [--no-color]
                                   Compare pre-tournament Monte Carlo odds to actual champion
  serve [--port N]                 Launch the web bracket viewer (default 3000)
  help                             Show this message

Team names may include ratings as Name:rating (e.g. Duke:1650).

Examples:
  bracketmind game Duke:1650 Kansas:1500 --seed 42
  bracketmind simulate Duke Kansas UConn Purdue --format tree
  bracketmind predict Duke Kansas UConn --iterations 5000
  bracketmind seedings Duke:1650 Kansas:1600 UConn:1550 Purdue:1500
  bracketmind upsets Duke:1650 Kansas:1600 UConn:1550 Purdue:1500
  bracketmind import season fixtures/seasons/2024-east-mini.json --format tree
  bracketmind import compare fixtures/seasons/2023-midwest-final-four.json --iterations 500
  bracketmind serve --port 3000
`);
  }
}
