import {
  createBracket,
  getChampion,
  parseTeams,
  renderBracket,
  simulateBracket,
} from "./bracket.js";
import { monteCarloChampionshipRates } from "./simulator.js";

export function runCli(args: string[]): void {
  const command = args[0] ?? "help";

  switch (command) {
    case "simulate": {
      const names = args.slice(1);
      if (names.length < 2) {
        console.error("Usage: bracketmind simulate <team1> <team2> [...]");
        process.exit(1);
      }

      const teams = parseTeams(names);
      const bracket = createBracket(teams);
      const result = simulateBracket(bracket);
      const champion = getChampion(result);

      console.log("Tournament Bracket Simulation\n");
      for (const line of renderBracket(result)) {
        console.log(line);
      }
      console.log(`Champion: ${champion.name}`);
      break;
    }

    case "predict": {
      const iterationsFlag = args.indexOf("--iterations");
      const iterations =
        iterationsFlag >= 0 ? parseInt(args[iterationsFlag + 1], 10) : 1000;
      const names = args.filter(
        (a, i) => a !== "--iterations" && i !== iterationsFlag + 1
      ).slice(1);

      if (names.length < 2 || Number.isNaN(iterations)) {
        console.error(
          "Usage: bracketmind predict <team1> <team2> [...] [--iterations N]"
        );
        process.exit(1);
      }

      const teams = parseTeams(names);
      const rates = monteCarloChampionshipRates(
        teams,
        iterations,
        (t) => getChampion(simulateBracket(createBracket(t)))
      );

      console.log(`Championship probabilities (${iterations} simulations)\n`);
      const sorted = [...rates.entries()].sort((a, b) => b[1] - a[1]);
      for (const [id, rate] of sorted) {
        const team = teams.find((t) => t.id === id);
        if (team?.name === "BYE") continue;
        console.log(`  ${team?.name ?? id}: ${(rate * 100).toFixed(1)}%`);
      }
      break;
    }

    case "help":
    default:
      console.log(`bracketmind — tournament bracket simulator

Commands:
  simulate <teams...>              Run a single bracket simulation
  predict <teams...> [--iterations N]
                                   Estimate championship odds via Monte Carlo
  help                             Show this message

Examples:
  bracketmind simulate Duke Kansas UConn Purdue
  bracketmind predict Duke Kansas UConn --iterations 5000
`);
  }
}
