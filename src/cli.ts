import {
  createBracket,
  getChampion,
  parseTeams,
  simulateBracket,
} from "./bracket.js";
import { monteCarloChampionshipRates } from "./simulator.js";
import { startServer } from "./server.js";
import {
  renderBracketList,
  renderChampionLine,
  renderFieldSummary,
} from "./display/renderList.js";
import { renderBracketTree } from "./display/renderTree.js";
import { renderPredictSection } from "./display/renderPredict.js";
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

function parseServeArgs(args: string[]): number {
  const portFlag = args.indexOf("--port");
  const port = portFlag >= 0 ? parseInt(args[portFlag + 1], 10) : 3000;
  return Number.isNaN(port) ? 3000 : port;
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

    case "serve": {
      const port = parseServeArgs(args);
      startServer(port);
      break;
    }

    case "help":
    default:
      console.log(`bracketmind — tournament bracket simulator

Commands:
  simulate <teams...> [--format list|tree] [--dynamic-ratings] [--no-color]
                                   Run a single bracket simulation
  predict <teams...> [--iterations N] [--dynamic-ratings] [--no-color]
                                   Estimate championship odds via Monte Carlo
  serve [--port N]                 Launch the web bracket viewer (default 3000)
  help                             Show this message

Examples:
  bracketmind simulate Duke Kansas UConn Purdue --format tree
  bracketmind predict Duke Kansas UConn --iterations 5000
  bracketmind serve --port 3000
`);
  }
}
