import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { parseSeasonFile, parseSeasonJson } from "./parseSeason.js";
import { serializeSeasonDocument } from "./serializeSeason.js";

const FIXTURES = join(import.meta.dirname, "../../fixtures/seasons");

describe("serializeSeasonDocument", () => {
  it("round-trips bundled fixtures with stable team and game ordering", () => {
    for (const filename of [
      "2023-east-mini.json",
      "2023-west-mini.json",
      "2024-south-region.json",
    ]) {
      const original = parseSeasonFile(join(FIXTURES, filename));
      const serialized = serializeSeasonDocument(original);
      const roundTripped = parseSeasonJson(serialized);

      expect(roundTripped).toEqual(original);
      expect(serialized.endsWith("\n")).toBe(true);
    }
  });

  it("sorts teams by seed and games by round/slot in output", () => {
    const doc = parseSeasonFile(join(FIXTURES, "2024-east-mini.json"));
    const shuffled = {
      ...doc,
      teams: [...doc.teams].reverse(),
      games: [...doc.games].reverse(),
    };
    const serialized = serializeSeasonDocument(shuffled);
    const parsed = parseSeasonJson(serialized);

    expect(parsed.teams.map((team) => team.seed)).toEqual(
      doc.teams.map((team) => team.seed)
    );
    expect(parsed.games.map((game) => [game.round, game.slot])).toEqual(
      doc.games.map((game) => [game.round, game.slot])
    );
  });
});
