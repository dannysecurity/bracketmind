import type { Bracket } from "../types.js";
import { buildBracketView, formatTeamLabel } from "./bracketView.js";
import { ColorOptions, champion, winner } from "./colors.js";

/** Render a boxed champion banner for terminal output. */
export function renderChampionBanner(
  bracket: Bracket,
  options: ColorOptions = { enabled: false }
): string[] {
  const view = buildBracketView(bracket);
  if (!view.champion) {
    return ["Champion: TBD"];
  }

  const label = formatTeamLabel(view.champion, true);
  const inner = options.enabled
    ? `Champion: ${winner(label, options)}`
    : `Champion: ${label}`;
  const styled = options.enabled ? champion(inner, options) : inner;
  const width = Math.max(styled.replace(/\x1b\[[0-9;]*m/g, "").length + 4, 30);
  const visibleInner = inner;
  const padding = Math.max(0, width - visibleInner.length - 2);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  const line = `║${" ".repeat(leftPad)}${styled}${" ".repeat(rightPad)}║`;
  const border = "═".repeat(width - 2);

  return [`╔${border}╗`, line, `╚${border}╝`];
}
