import { describe, expect, it } from "vitest";
import {
  buildRoundConnectorPaths,
  CONNECTOR_ZONE_WIDTH,
  renderRoundConnectorSvg,
} from "./bracketConnectors.js";
import { displayRow, matchExtents } from "./bracketLayout.js";

describe("bracketConnectors", () => {
  it("draws T-connectors for opening-round matches", () => {
    const paths = buildRoundConnectorPaths(0, 2, 2);

    expect(paths).toHaveLength(8);
    expect(paths.slice(0, 4)).toEqual([
      "M 0 0 H 10",
      "M 0 2 H 10",
      "M 10 0 V 2",
      "M 10 1 H 20",
    ]);
  });

  it("joins feeder mids for later-round matches", () => {
    const paths = buildRoundConnectorPaths(1, 3, 4);
    const feederTopY = displayRow(matchExtents(0, 0, 3).mid);
    const feederBottomY = displayRow(matchExtents(0, 1, 3).mid);
    const midY = displayRow(matchExtents(1, 0, 3).mid);

    expect(paths).toHaveLength(6);
    expect(paths.slice(0, 3)).toEqual([
      `M 0 ${Math.min(feederTopY, feederBottomY, midY)} V ${Math.max(feederTopY, feederBottomY, midY)}`,
      `M 0 ${midY} H 10`,
      `M 10 ${midY} H 20`,
    ]);
  });

  it("emits four path segments per opening-round slot in an 8-team bracket", () => {
    const paths = buildRoundConnectorPaths(0, 3, 4);
    expect(paths).toHaveLength(16);
  });

  it("returns no paths for the final round", () => {
    expect(buildRoundConnectorPaths(2, 3, 4)).toEqual([]);
  });

  it("renders SVG with viewBox height matching the grid row count", () => {
    const svg = renderRoundConnectorSvg(0, 2, 2, 6);

    expect(svg).toContain('class="round-connectors"');
    expect(svg).toContain(`viewBox="0 0 ${CONNECTOR_ZONE_WIDTH} 6"`);
    expect(svg).toContain("<path d=");
    expect(svg).toContain('vector-effect="non-scaling-stroke"');
  });

  it("omits SVG markup when the round has no outgoing connectors", () => {
    expect(renderRoundConnectorSvg(2, 3, 4, 14)).toBe("");
  });
});
