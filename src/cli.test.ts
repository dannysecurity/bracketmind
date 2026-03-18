import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

  it("exits with usage when game --trials is not a number", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["game", "Alpha", "Beta", "--trials", "abc"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("applies round-aware rating deltas with --round and --total-rounds", () => {
    const early = captureOutput(() => {
      runCli([
        "game",
        "Alpha:1500",
        "Beta:1500",
        "--seed",
        "99",
        "--dynamic-ratings",
        "--round",
        "0",
        "--total-rounds",
        "4",
        "--no-color",
      ]);
    });
    const late = captureOutput(() => {
      runCli([
        "game",
        "Alpha:1500",
        "Beta:1500",
        "--seed",
        "99",
        "--dynamic-ratings",
        "--round",
        "3",
        "--total-rounds",
        "4",
        "--no-color",
      ]);
    });

    expect(early.stdout).toContain("Round context: Round of 16");
    expect(late.stdout).toContain("Round context: Final");

    const earlyDelta = early.stdout.match(/Rating change: Alpha \+(\d+)/)?.[1];
    const lateDelta = late.stdout.match(/Rating change: Alpha \+(\d+)/)?.[1];
    expect(Number(lateDelta)).toBeGreaterThan(Number(earlyDelta));
  });

  it("exits when round context is out of range", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli([
        "game",
        "Alpha",
        "Beta",
        "--round",
        "4",
        "--total-rounds",
        "4",
        "--no-color",
      ]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Round context must satisfy");
  });

  it("simulates a game with historical seed upset blending", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "game",
        "UMBC:1450",
        "Virginia:1700",
        "--seed-a",
        "16",
        "--seed-b",
        "1",
        "--historical-weight",
        "0.35",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Seeds: #16 vs #1");
    expect(stdout).toContain("historical upset rates (35%)");
  });

  it("simulates a best-of-three series with per-game scores", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "game",
        "Duke:1650",
        "Kansas:1500",
        "--best-of",
        "3",
        "--seed",
        "42",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Best-of-3 Series");
    expect(stdout).toContain("Game 1:");
    expect(stdout).toMatch(/Series: .+ wins \d-\d/);
  });

  it("shows final ratings after a dynamic-ratings best-of series", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "game",
        "Alpha:1500",
        "Beta:1500",
        "--best-of",
        "3",
        "--seed",
        "42",
        "--dynamic-ratings",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Best-of-3 Series");
    expect(stdout).toContain("Final ratings:");
  });

  it("exits when --best-of is even", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["game", "Alpha", "Beta", "--best-of", "4"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("--best-of must be an odd positive integer");
  });

  it("exits when --best-of and --trials are combined", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli([
        "game",
        "Alpha",
        "Beta",
        "--best-of",
        "3",
        "--trials",
        "100",
      ]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("--best-of and --trials cannot be used together");
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
    expect(stdout).toContain("Round 1 Upset Outlook");
    expect(stdout).toContain("Expected first-round upsets:");
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

  it("accepts historical-weight on upsets command", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "upsets",
        "Duke:1650",
        "Kansas:1600",
        "UConn:1550",
        "Purdue:1500",
        "--historical-weight",
        "0",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Tournament Upset Landscape");
    expect(stdout).toContain("43% Elo · 48% historical · 43% blended upset chance");
  });

  it("accepts historical-weight on seedings command", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "seedings",
        "Duke:1650",
        "Kansas:1600",
        "UConn:1550",
        "Purdue:1500",
        "--historical-weight",
        "1",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Round 1 Upset Outlook");
    expect(stdout).toContain("historical ·");
  });

  it("exits with usage when upsets has too few teams", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["upsets", "Alpha"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("prints tournament chalk index and seed-line vulnerability", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "chalk",
        "Duke:1650",
        "Kansas:1600",
        "UConn:1550",
        "Purdue:1500",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Tournament Upset Index");
    expect(stdout).toContain("Chalk index:");
    expect(stdout).toContain("Seed-Line Vulnerability");
  });

  it("exits with usage when chalk has too few teams", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["chalk", "Alpha"]);
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

  it("lists bundled historical season fixtures", () => {
    const { stdout } = captureOutput(() => {
      runCli(["import", "list", "--no-color"]);
    });

    expect(stdout).toContain("Bundled Historical Season Fixtures");
    expect(stdout).toContain("2024-south-region");
    expect(stdout).toContain("2024-east-mini");
    expect(stdout).toContain("2023-east-mini");
    expect(stdout).toContain("2023-west-mini");
    expect(stdout).toContain("★ UConn");
  });

  it("shows compact fixture info without rendering the full bracket", () => {
    const { stdout } = captureOutput(() => {
      runCli(["import", "info", "@2023-east-mini", "--no-color"]);
    });

    expect(stdout).toContain("Season Fixture Info");
    expect(stdout).toContain("2023-east-mini");
    expect(stdout).toContain("Status: Complete");
    expect(stdout).toContain("Champion: UConn");
    expect(stdout).not.toContain("Round 1");
  });

  it("imports a fixture by catalog alias", () => {
    const { stdout } = captureOutput(() => {
      runCli(["import", "season", "@2024-south-region", "--no-color"]);
    });

    expect(stdout).toContain("2024 NCAA South Region");
    expect(stdout).toContain("Champion:");
    expect(stdout).toContain("Houston");
  });

  it("analyzes upset probabilities for recorded games", () => {
    const { stdout } = captureOutput(() => {
      runCli(["import", "upsets", "@2024-east-mini", "--no-color"]);
    });

    expect(stdout).toContain("Recorded Game Upset Analysis");
    expect(stdout).toContain("Pre-game lower-rated win chance:");
    expect(stdout).toContain("UConn");
  });

  it("exits with usage when import path is missing", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["import", "season"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("dry-runs importing an external season fixture", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "import",
        "add",
        "fixtures/seasons/2023-west-mini.json",
        "--dry-run",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Historical Season Fixture Import");
    expect(stdout).toContain("2023-west-mini");
    expect(stdout).toContain("Would write fixture to");
    expect(stdout).toContain("Re-run without --dry-run");
  });

  it("writes an imported season fixture to a custom directory", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "bracketmind-import-"));
    try {
      const { stdout } = captureOutput(() => {
        runCli([
          "import",
          "add",
          "fixtures/seasons/2023-west-mini.json",
          "--out",
          tempDir,
          "--force",
          "--no-color",
        ]);
      });

      const outputPath = join(tempDir, "2023-west-mini.json");
      expect(stdout).toContain("Wrote fixture to");
      expect(stdout).toContain(outputPath);
      expect(existsSync(outputPath)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("dry-runs batch importing season fixtures from a directory", () => {
    const { stdout } = captureOutput(() => {
      runCli([
        "import",
        "add-dir",
        "fixtures/seasons",
        "--dry-run",
        "--no-color",
      ]);
    });

    expect(stdout).toContain("Historical Season Batch Import");
    expect(stdout).toContain("Would import:");
    expect(stdout).toContain("2023-south-region");
    expect(stdout).toContain("Re-run without --dry-run");
  });
});
