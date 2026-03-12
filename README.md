# bracketmind

Tournament bracket simulator with Elo-based team ratings, probabilistic game simulation, and a CLI for running brackets and championship predictions.

## Features

- **Single-elimination brackets** — automatically seeds teams by rating and pads to the next power of two
- **Elo ratings** — expected win probabilities and margin-, round-, and upset-aware post-game updates
- **Game simulation** — score generation driven by rating differential; head-to-head Monte Carlo forecasts via `game --trials`; best-of series via `game --best-of`
- **Monte Carlo predictions** — estimate championship odds across thousands of simulated tournaments
- **Analytical upset analysis** — path-weighted upset probabilities for every bracket round
- **Historical seed upset model** — blends Elo forecasts with round-aware NCAA seed matchup upset rates in `seedings` and `upsets`
- **CLI** — simulate a bracket or forecast outcomes from the terminal
- **Display formats** — round-labeled list view, ASCII tree layout, and predict bar charts
- **Web viewer** — lightweight browser UI via `serve`

## Quick start

```bash
npm install
npm run build
npm start simulate Duke Kansas UConn Purdue -- --format tree
npm start predict Duke Kansas UConn Purdue --iterations 2000
npm start game Duke:1650 Kansas:1500 --best-of 3 --seed 42
npm start game Duke:1650 Kansas:1500 --trials 5000 --seed 42
npm start game Duke:1650 Kansas:1500 --dynamic-ratings --round 3 --total-rounds 4
npm start upsets Duke:1650 Kansas:1600 UConn:1550 Purdue:1500
npm start serve -- --port 3000
```

During development:

```bash
npm run dev simulate Alpha Beta Gamma Delta
npm test
```

## CLI

| Command | Description |
|---------|-------------|
| `game <team1> <team2> [--seed N] [--trials N] [--best-of N] [--dynamic-ratings] [--round N] [--total-rounds N] [--no-color]` | Simulate one game, a best-of series, or forecast head-to-head odds (default 1 trial) |
| `simulate <teams...> [--format list\|tree] [--no-color]` | Run one full bracket and print results |
| `predict <teams...> [--iterations N] [--no-color]` | Championship probability estimates (default 1000 runs) |
| `seedings <teams...> [--no-color]` | Show rating-based seeds, round-one upset odds, and blended historical seed outlook |
| `upsets <teams...> [--no-color]` | Analyze upset probabilities for every bracket round |
| `serve [--port N]` | Launch the web bracket viewer (default port 3000) |
| `help` | Show usage |

## Project layout

```
src/
  ratings.ts       Elo expected score and base rating math
  eloUpdates.ts    Margin-, round-, and upset-aware tournament Elo updates
  simulator.ts     Single-game simulation and Monte Carlo helpers
  bracket.ts       Bracket construction and simulation
  probability/     Round-aware historical upset rates, seed helpers, and analytical bracket paths
  seeding.ts       Round-one seeding and upset summaries
  display/         Shared bracket view model and CLI/HTML renderers
  cli.ts           Command-line interface
  server.ts        Minimal web viewer for bracket display
  index.ts         Entry point
```

## License

MIT
