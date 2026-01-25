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
  monteCarloGameOutcomes,
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
import { renderGameMonteCarloSummary } from "./display/renderGameMonteCarlo.js";
import { renderPredictSection } from "./display/renderPredict.js";
import {
  renderSeasonHeader,
  renderSeasonPredictionComparison,
  renderSeasonRatingReplay,
  renderSeasonValidation,
  renderFixtureCatalog,
  renderSeasonInfo,
  renderSeasonUpsetAnalysis,
} from "./display/renderSeason.js";
import { renderSeedingsSection } from "./display/renderSeedings.js";
import { renderUpsetsSection } from "./display/renderUpsets.js";
import {
  analyzeSeasonUpsets,
  compareSeasonPredictions,
  listBundledFixtures,
  loadSeasonBracket,
  loadSeasonFixture,
  replaySeasonRatings,
  summarizeSeason,
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

function parseHistoricalWeight(args: string[]): {
  historicalWeight?: number;
  filtered: string[];
} {
  const flag = args.indexOf("--historical-weight");
  if (flag < 0) {
    return { filtered: args };
  }

  const value = parseFloat(args[flag + 1] ?? "");
  const historicalWeight = Number.isNaN(value) ? undefined : value;
  const filtered = args.filter(
    (value, index) => value !== "--historical-weight" && index !== flag + 1
  );

  return { historicalWeight, filtered };
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
  historicalWeight?: number;
} {
  const { historicalWeight, filtered } = parseHistoricalWeight(args);
  const noColor = filtered.includes("--no-color");
  const names = filtered.filter((value) => value !== "--no-color").slice(1);

  return {
    names,
    color: { enabled: !noColor && supportsColor() },
    historicalWeight,
  };
}

function parseUpsetsArgs(args: string[]): {
  names: string[];
  color: ColorOptions;
  historicalWeight?: number;
} {
  const { historicalWeight, filtered } = parseHistoricalWeight(args);
  const noColor = filtered.includes("--no-color");
  const names = filtered.filter((value) => value !== "--no-color").slice(1);

  return {
    names,
    color: { enabled: !noColor && supportsColor() },
    historicalWeight,
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
  trials: number;
} {
  const seedFlag = args.indexOf("--seed");
  const seedValue = seedFlag >= 0 ? parseInt(args[seedFlag + 1], 10) : undefined;
  const trialsFlag = args.indexOf("--trials");
  const trialsValue =
    trialsFlag >= 0 ? parseInt(args[trialsFlag + 1], 10) : 1;
  const noColor = args.includes("--no-color");
  const dynamicRatings = args.includes("--dynamic-ratings");
  const teamSpecs = args
    .filter(
      (value, index) =>
        value !== "--seed" &&
        (seedFlag < 0 || index !== seedFlag + 1) &&
        value !== "--trials" &&
        (trialsFlag < 0 || index !== trialsFlag + 1) &&
        value !== "--no-color" &&
        value !== "--dynamic-ratings"
    )
    .slice(1);

  return {
    teamSpecs,
    color: { enabled: !noColor && supportsColor() },
    dynamicRatings,
    seed: seedValue !== undefined && !Number.isNaN(seedValue) ? seedValue : undefined,
    trials:
      trialsFlag >= 0 && Number.isNaN(trialsValue) ? 0 : trialsValue,
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
      const { teamSpecs, color, dynamicRatings, seed, trials } = parseGameArgs(args);
      if (teamSpecs.length !== 2 || trials <= 0) {
        console.error(
          "Usage: bracketmind game <team1> <team2> [--seed N] [--trials N] [--dynamic-ratings] [--no-color]"
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
      const simulationOptions = {
        rng,
        tournamentState,
      };

      if (trials > 1) {
        const forecast = monteCarloGameOutcomes(teamA, teamB, trials, simulationOptions);

        for (const line of renderGameResult(teamA, teamB, forecast.sampleResult, {
          ...color,
          showRatingDeltas: dynamicRatings,
        })) {
          console.log(line);
        }

        for (const line of renderGameMonteCarloSummary(teamA, teamB, forecast, color)) {
          console.log(line);
        }
        break;
      }

      const result = simulateGame(teamA, teamB, simulationOptions);

      for (const line of renderGameResult(teamA, teamB, result, {
        ...color,
        showRatingDeltas: dynamicRatings,
      })) {
        console.log(line);
      }
      break;
    }

    case "seedings": {
      const { names, color, historicalWeight } = parseSeedingsArgs(args);
      if (names.length < 2) {
        console.error(
          "Usage: bracketmind seedings <team1> <team2> [...] [--historical-weight 0-1] [--no-color]"
        );
        process.exit(1);
      }

      const teams = parseTeams(names);
      for (const line of renderSeedingsSection(teams, {
        ...color,
        historicalWeight,
      })) {
        console.log(line);
      }
      break;
    }

    case "upsets": {
      const { names, color, historicalWeight } = parseUpsetsArgs(args);
      if (names.length < 2) {
        console.error(
          "Usage: bracketmind upsets <team1> <team2> [...] [--historical-weight 0-1] [--no-color]"
        );
        process.exit(1);
      }

      const teams = parseTeams(names);
      for (const line of renderUpsetsSection(teams, {
        ...color,
        historicalWeight,
      })) {
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

      if (subcommand === "list") {
        for (const line of renderFixtureCatalog(listBundledFixtures(), color)) {
          console.log(line);
        }
        break;
      }

      if (!path) {
        console.error(
          "Usage: bracketmind import <season|info|ratings|compare|validate|upsets|list> <path.json|@fixture-id> [--format list|tree] [--iterations N] [--no-color]"
        );
        process.exit(1);
      }

      let doc;
      try {
        doc = loadSeasonFixture(path);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load season fixture: ${message}`);
        process.exit(1);
      }

      switch (subcommand) {
        case "info": {
          const summary = summarizeSeason(doc);
          for (const line of renderSeasonInfo(doc, summary, color)) {
            console.log(line);
          }
          break;
        }

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

        case "validate": {
          const summary = summarizeSeason(doc);
          for (const line of renderSeasonValidation(doc, summary, color)) {
            console.log(line);
          }
          break;
        }

        case "upsets": {
          const analyses = analyzeSeasonUpsets(doc);
          const totalRounds = Math.ceil(Math.log2(doc.teams.length));
          for (const line of renderSeasonHeader(doc, color)) {
            console.log(line);
          }
          for (const line of renderSeasonUpsetAnalysis(analyses, totalRounds, color)) {
            console.log(line);
          }
          break;
        }

        default:
          console.error(
            "Usage: bracketmind import <season|info|ratings|compare|validate|upsets|list> <path.json|@fixture-id> [--format list|tree] [--iterations N] [--no-color]"
          );
          process.exit(1);
      }
      break;
    }

    case "help":
    default:
      console.log(`bracketmind — tournament bracket simulator

Commands:
  game <team1> <team2> [--seed N] [--trials N] [--dynamic-ratings] [--no-color]
                                   Simulate a single head-to-head game
  simulate <teams...> [--format list|tree] [--dynamic-ratings] [--no-color]
                                   Run a single bracket simulation
  predict <teams...> [--iterations N] [--dynamic-ratings] [--no-color]
                                   Estimate championship odds via Monte Carlo
  seedings <teams...> [--historical-weight 0-1] [--no-color]
                                   Show rating-based seeds and round 1 upset odds
  upsets <teams...> [--historical-weight 0-1] [--no-color]
                                   Analyze upset probabilities for every round
  import season <path.json|@fixture-id> [--format list|tree] [--no-color]
                                   Load a historical season fixture and display results
  import info <path.json|@fixture-id> [--no-color]
                                   Show a compact summary of a season fixture
  import ratings <path.json|@fixture-id> [--no-color]
                                   Replay recorded games and show post-tournament Elo shifts
  import compare <path.json> [--iterations N] [--no-color]
                                   Compare pre-tournament Monte Carlo odds to actual champion
  import validate <path.json|@fixture-id> [--no-color]
                                   Validate a season fixture and summarize completeness
  import upsets <path.json|@fixture-id> [--no-color]
                                   Analyze upset probabilities for each recorded game
  import list [--no-color]
                                   List bundled historical season fixtures
  serve [--port N]                 Launch the web bracket viewer (default 3000)
  help                             Show this message

Team names may include ratings as Name:rating (e.g. Duke:1650).

Examples:
  bracketmind game Duke:1650 Kansas:1500 --seed 42
  bracketmind game Duke:1650 Kansas:1500 --trials 5000 --seed 42
  bracketmind simulate Duke Kansas UConn Purdue --format tree
  bracketmind predict Duke Kansas UConn --iterations 5000
  bracketmind seedings Duke:1650 Kansas:1600 UConn:1550 Purdue:1500
  bracketmind upsets Duke:1650 Kansas:1600 UConn:1550 Purdue:1500
  bracketmind import season fixtures/seasons/2024-east-mini.json --format tree
  bracketmind import info @2023-east-mini
  bracketmind import season @2024-south-region --format tree
  bracketmind import compare fixtures/seasons/2023-midwest-final-four.json --iterations 500
  bracketmind import validate fixtures/seasons/2024-west-mini.json
  bracketmind import upsets @2024-south-region
  bracketmind import list
  bracketmind serve --port 3000
`);
  }
}
