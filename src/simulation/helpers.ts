import { effectiveRating } from "../tournamentState.js";
import type { SimulationOptions, Team } from "../types.js";

/** Shallow-copy a team so simulations can update ratings without mutating inputs. */
export function cloneTeam(team: Team): Team {
  return { ...team };
}

/** Rating used for win probability and score generation in a single-game simulation. */
export function ratingForTeam(team: Team, options: SimulationOptions): number {
  if (options.tournamentState) {
    return effectiveRating(team, options.tournamentState);
  }
  return team.rating;
}
