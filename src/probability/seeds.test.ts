import { describe, expect, it } from "vitest";
import { parseTeams } from "../bracket.js";
import type { Team } from "../types.js";
import { buildSeedMap, buildSeededTeams } from "./seeds.js";

function withRatings(names: string[], ratings: number[]): Team[] {
  return parseTeams(names).map((team, index) => ({
    ...team,
    rating: ratings[index],
  }));
}

describe("buildSeedMap", () => {
  it("assigns seeds 1 through N by descending rating when no official seeds exist", () => {
    const teams = withRatings(["Low", "High", "Mid"], [1500, 1700, 1600]);
    const seeds = buildSeedMap(teams);

    expect(seeds.get(teams[1].id)).toBe(1);
    expect(seeds.get(teams[2].id)).toBe(2);
    expect(seeds.get(teams[0].id)).toBe(3);
  });

  it("uses official tournament seeds when any team carries a seed field", () => {
    const teams = withRatings(["Alpha", "Beta", "Gamma"], [1600, 1700, 1500]).map(
      (team, index) => ({
        ...team,
        seed: [3, 1, 2][index],
      })
    );
    const seeds = buildSeedMap(teams);

    expect(seeds.get(teams[0].id)).toBe(3);
    expect(seeds.get(teams[1].id)).toBe(1);
    expect(seeds.get(teams[2].id)).toBe(2);
  });

  it("ignores BYE placeholders when building the seed map", () => {
    const teams = [
      ...withRatings(["A", "B"], [1700, 1600]),
      { id: "bye", name: "BYE", rating: 0 },
    ];
    const seeds = buildSeedMap(teams);

    expect(seeds.size).toBe(2);
    expect(seeds.has("bye")).toBe(false);
  });
});

describe("buildSeededTeams", () => {
  it("returns teams ordered by rating when no official seeds exist", () => {
    const teams = withRatings(["Low", "High", "Mid"], [1500, 1700, 1600]);

    expect(buildSeededTeams(teams)).toEqual([
      { seed: 1, team: teams[1] },
      { seed: 2, team: teams[2] },
      { seed: 3, team: teams[0] },
    ]);
  });

  it("orders by official seed when tournament seeds are present", () => {
    const teams = withRatings(["Alpha", "Beta", "Gamma"], [1600, 1700, 1500]).map(
      (team, index) => ({
        ...team,
        seed: [3, 1, 2][index],
      })
    );

    expect(buildSeededTeams(teams).map((entry) => entry.seed)).toEqual([1, 2, 3]);
    expect(buildSeededTeams(teams)[0].team.name).toBe("Beta");
  });

  it("excludes BYE placeholders from seeded team lists", () => {
    const teams = [
      ...withRatings(["A", "B"], [1700, 1600]),
      { id: "bye", name: "BYE", rating: 0 },
    ];

    expect(buildSeededTeams(teams)).toHaveLength(2);
    expect(buildSeededTeams(teams).every((entry) => entry.team.name !== "BYE")).toBe(
      true
    );
  });
});
