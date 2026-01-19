import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBracket, getChampion, parseTeams, simulateBracket } from "./bracket.js";
import {
  renderCombinedPage,
  renderPredictPage,
  renderSimulatePage,
  type BracketHtmlFormat,
  type ViewerOptions,
} from "./display/renderHtml.js";
import { monteCarloChampionshipRates } from "./simulator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadAsset(name: string): string {
  return readFileSync(join(__dirname, "web", name), "utf8");
}

function parseTeamNames(raw: string | null): string[] {
  if (!raw) {
    return ["Duke", "Kansas", "UConn", "Purdue"];
  }

  return raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function parseViewerOptions(url: URL): ViewerOptions {
  const formatParam = url.searchParams.get("format");
  const format: BracketHtmlFormat =
    formatParam === "cards" ? "cards" : "aligned";
  const iterationsRaw = parseInt(url.searchParams.get("iterations") ?? "1000", 10);
  const iterations = Number.isNaN(iterationsRaw) ? 1000 : Math.min(100_000, Math.max(100, iterationsRaw));
  const modeParam = url.searchParams.get("mode");
  const mode =
    modeParam === "predict" || modeParam === "both" ? modeParam : "simulate";

  return { mode, format, iterations };
}

function sendHtml(res: ServerResponse, body: string): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/style.css") {
    res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
    res.end(loadAsset("style.css"));
    return;
  }

  if (url.pathname !== "/") {
    sendText(res, 404, "Not found");
    return;
  }

  const names = parseTeamNames(url.searchParams.get("teams"));
  if (names.length < 2) {
    sendText(res, 400, "At least two teams are required");
    return;
  }

  const teams = parseTeams(names);
  const options = parseViewerOptions(url);

  if (options.mode === "predict") {
    const rates = monteCarloChampionshipRates(
      teams,
      options.iterations ?? 1000,
      (field) => getChampion(simulateBracket(createBracket(field)))
    );
    sendHtml(res, renderPredictPage(rates, teams, names, options));
    return;
  }

  const result = simulateBracket(createBracket(teams));

  if (options.mode === "both") {
    const rates = monteCarloChampionshipRates(
      teams,
      options.iterations ?? 1000,
      (field) => getChampion(simulateBracket(createBracket(field)))
    );
    sendHtml(res, renderCombinedPage(result, rates, teams, names, options));
    return;
  }

  sendHtml(res, renderSimulatePage(result, names, options));
}

/** Start a minimal web viewer for bracket simulation and predictions. */
export function startServer(port = 3000): void {
  const server = createServer(handleRequest);
  server.listen(port, () => {
    console.log(`bracketmind viewer running at http://localhost:${port}`);
  });
}
