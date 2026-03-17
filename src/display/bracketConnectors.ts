import { displayRow, matchExtents } from "./bracketLayout.js";

/** Width of the connector zone in SVG viewBox units. */
export const CONNECTOR_ZONE_WIDTH = 20;

/** Horizontal extent where feeder lines meet before the outgoing stub. */
const JUNCTION_X = CONNECTOR_ZONE_WIDTH * 0.5;

/**
 * Build SVG path commands for bracket lines leaving a round column.
 * Coordinates use grid row indices (same space as `displayRow`).
 */
export function buildRoundConnectorPaths(
  round: number,
  totalRounds: number,
  firstRoundMatchCount: number
): string[] {
  if (round >= totalRounds - 1) {
    return [];
  }

  const slotCount = firstRoundMatchCount / Math.pow(2, round);
  const paths: string[] = [];

  for (let slot = 0; slot < slotCount; slot++) {
    if (round === 0) {
      paths.push(...openingRoundPaths(slot, totalRounds));
    } else {
      paths.push(...laterRoundPaths(round, slot, totalRounds));
    }
  }

  return paths;
}

function openingRoundPaths(slot: number, totalRounds: number): string[] {
  const { top, bottom, mid } = matchExtents(0, slot, totalRounds);
  const topY = displayRow(top);
  const bottomY = displayRow(bottom);
  const midY = displayRow(mid);

  return [
    `M 0 ${topY} H ${JUNCTION_X}`,
    `M 0 ${bottomY} H ${JUNCTION_X}`,
    `M ${JUNCTION_X} ${topY} V ${bottomY}`,
    `M ${JUNCTION_X} ${midY} H ${CONNECTOR_ZONE_WIDTH}`,
  ];
}

function laterRoundPaths(round: number, slot: number, totalRounds: number): string[] {
  const midY = displayRow(matchExtents(round, slot, totalRounds).mid);
  const feederTopY = displayRow(matchExtents(round - 1, slot * 2, totalRounds).mid);
  const feederBottomY = displayRow(matchExtents(round - 1, slot * 2 + 1, totalRounds).mid);
  const spanStart = Math.min(feederTopY, feederBottomY, midY);
  const spanEnd = Math.max(feederTopY, feederBottomY, midY);

  return [
    `M 0 ${spanStart} V ${spanEnd}`,
    `M 0 ${midY} H ${JUNCTION_X}`,
    `M ${JUNCTION_X} ${midY} H ${CONNECTOR_ZONE_WIDTH}`,
  ];
}

/** Render connector paths as an SVG overlay sized to the bracket grid. */
export function renderRoundConnectorSvg(
  round: number,
  totalRounds: number,
  firstRoundMatchCount: number,
  rowCount: number
): string {
  const paths = buildRoundConnectorPaths(round, totalRounds, firstRoundMatchCount);
  if (paths.length === 0) {
    return "";
  }

  const pathMarkup = paths
    .map((path) => `<path d="${path}" vector-effect="non-scaling-stroke" />`)
    .join("\n          ");

  return `<svg class="round-connectors" viewBox="0 0 ${CONNECTOR_ZONE_WIDTH} ${rowCount}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          ${pathMarkup}
        </svg>`;
}
