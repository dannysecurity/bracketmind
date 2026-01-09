const ROUND_NAMES: Record<number, string> = {
  1: "Final",
  2: "Semifinals",
  3: "Quarterfinals",
  4: "Round of 16",
  5: "Round of 32",
};

export function roundLabel(round: number, totalRounds: number): string {
  const roundsFromFinal = totalRounds - round;
  return ROUND_NAMES[roundsFromFinal] ?? `Round ${round + 1}`;
}
