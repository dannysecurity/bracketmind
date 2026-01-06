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
});
