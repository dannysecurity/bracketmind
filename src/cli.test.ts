import { describe, expect, it } from "vitest";
import { runCli } from "./cli.js";

function captureOutput(fn: () => void): { stdout: string; stderr: string; exitCode: number | null } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalExit = process.exit;

  let exitCode: number | null = null;
  console.log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  };
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new Error("process.exit");
  }) as typeof process.exit;

  try {
    fn();
  } catch {
    // process.exit throws in tests
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
    exitCode,
  };
}

describe("runCli", () => {
  it("prints tree output when --format tree is used", () => {
    const { stdout } = captureOutput(() => {
      runCli(["simulate", "Alpha", "Beta", "Gamma", "Delta", "--format", "tree", "--no-color"]);
    });

    expect(stdout).toContain("Semifinals");
    expect(stdout).toContain("Champion:");
  });

  it("prints bar chart output for predict", () => {
    const { stdout } = captureOutput(() => {
      runCli(["predict", "Alpha", "Beta", "--iterations", "50", "--no-color"]);
    });

    expect(stdout).toContain("Championship probabilities");
    expect(stdout).toContain("Alpha");
    expect(stdout).toContain("Beta");
  });

  it("exits with usage when simulate has too few teams", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["simulate", "Alpha"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("simulates a single game with custom ratings", () => {
    const { stdout } = captureOutput(() => {
      runCli(["game", "Duke:1650", "Kansas:1500", "--no-color"]);
    });

    expect(stdout).toContain("Game Simulation");
    expect(stdout).toContain("Duke (1650) vs Kansas (1500)");
    expect(stdout).toMatch(/→ Duke \d+ - Kansas \d+/);
    expect(stdout).toContain("Pre-game favorite: Duke");
  });

  it("replays the same game with a fixed seed", () => {
    const first = captureOutput(() => {
      runCli(["game", "Alpha", "Beta", "--seed", "7", "--no-color"]);
    });
    const second = captureOutput(() => {
      runCli(["game", "Alpha", "Beta", "--seed", "7", "--no-color"]);
    });

    expect(first.stdout).toBe(second.stdout);
  });

  it("exits with usage when game has the wrong number of teams", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["game", "Alpha"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("prints head-to-head forecast when --trials is set", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "game",
        "Duke:1650",
        "Kansas:1500",
        "--trials",
        "200",
        "--seed",
        "42",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Game Simulation");
    expect(stdout).toContain("Head-to-head forecast (200 simulations)");
    expect(stdout).toContain("Duke");
    expect(stdout).toContain("Kansas");
    expect(stdout).toContain("Upset rate:");
  });

  it("exits with usage when game --trials is zero", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["game", "Alpha", "Beta", "--trials", "0"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("prints seedings and round-one upset probabilities", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "seedings",
        "Duke:1650",
        "Kansas:1600",
        "UConn:1550",
        "Purdue:1500",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Bracket Seedings");
    expect(stdout).toContain("#1 Duke (1650)");
    expect(stdout).toContain("Round 1 Matchups");
    expect(stdout).toContain("Most likely first-round upset:");
  });

  it("exits with usage when seedings has too few teams", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["seedings", "Alpha"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("prints tournament-wide upset analysis", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "upsets",
        "Duke:1650",
        "Kansas:1600",
        "UConn:1550",
        "Purdue:1500",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Tournament Upset Landscape");
    expect(stdout).toContain("Semifinals");
    expect(stdout).toContain("Most Likely Upset");
  });

  it("exits with usage when upsets has too few teams", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["upsets", "Alpha"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("imports and displays a historical season fixture", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "import",
        "season",
        "fixtures/seasons/2024-east-mini.json",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Historical Season Import");
    expect(stdout).toContain("2024 NCAA East Region");
    expect(stdout).toContain("Champion:");
    expect(stdout).toContain("UConn");
  });

  it("replays season ratings from a fixture", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "import",
        "ratings",
        "fixtures/seasons/2023-midwest-final-four.json",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Post-Tournament Rating Changes");
    expect(stdout).toContain("Purdue:");
  });

  it("compares predictions against actual champion", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "import",
        "compare",
        "fixtures/seasons/2023-midwest-final-four.json",
        "--iterations",
        "50",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Predictions vs Actual");
    expect(stdout).toContain("Actual champion: Purdue");
  });

  it("validates a historical season fixture", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "import",
        "validate",
        "fixtures/seasons/2024-west-mini.json",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Historical Season Validation");
    expect(stdout).toContain("2024 NCAA West Region");
    expect(stdout).toContain("Status: Complete");
    expect(stdout).toContain("Champion: North Carolina");
  });

  it("exits with usage when import path is missing", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["import", "season"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });
});
