# bracketmind

Tournament bracket simulator with Elo-based team ratings, probabilistic game simulation, and a CLI for running brackets and championship predictions.

## Features

- **Single-elimination brackets** — automatically seeds teams by rating and pads to the next power of two
- **Elo ratings** — expected win probabilities and post-game rating updates
- **Game simulation** — score generation driven by rating differential
- **Monte Carlo predictions** — estimate championship odds across thousands of simulated tournaments
- **CLI** — simulate a bracket or forecast outcomes from the terminal
- **Display formats** — round-labeled list view, ASCII tree layout, and predict bar charts
- **Web viewer** — lightweight browser UI via `serve`

## Quick start

```bash
npm install
npm run build
npm start simulate Duke Kansas UConn Purdue -- --format tree
npm start predict Duke Kansas UConn Purdue --iterations 2000
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
| `simulate <teams...> [--format list\|tree] [--no-color]` | Run one full bracket and print results |
| `predict <teams...> [--iterations N] [--no-color]` | Championship probability estimates (default 1000 runs) |
| `serve [--port N]` | Launch the web bracket viewer (default port 3000) |
| `help` | Show usage |

## Project layout

```
src/
  ratings.ts     Elo expected score and rating updates
  simulator.ts   Single-game simulation and Monte Carlo helpers
  bracket.ts     Bracket construction and simulation
  display/       Shared bracket view model and CLI/HTML renderers
  cli.ts         Command-line interface
  server.ts      Minimal web viewer for bracket display
  index.ts       Entry point
```

## License

MIT
