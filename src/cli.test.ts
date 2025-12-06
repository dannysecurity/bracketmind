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
    expect(stdout).toMatch(/Alpha[\s\S]*Beta/);
  });

  it("exits with usage when simulate has too few teams", () => {
    const { exitCode, stderr } = captureOutput(() => {
      runCli(["simulate", "Alpha"]);
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });
});
