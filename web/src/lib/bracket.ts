/**
 * Bracket structure, mirror of server/src/services/bracketLogic.ts (keep in sync).
 * Matches are numbered round by round; outcomes and picks hold the slot index
 * of each match winner, or null when unknown. An empty slot ("") is a bye.
 */
export const BRACKET_SIZES = [4, 8, 16, 32] as const;
export const BYE = -1;

export const roundCount = (size: number) => Math.log2(size);
export const roundOffset = (size: number, round: number) => size - size / 2 ** round;
export const matchesIn = (size: number, round: number) => size / 2 ** (round + 1);

export function roundOf(size: number, match: number): number {
  let r = 0;
  while (match >= roundOffset(size, r + 1)) r++;
  return r;
}

export function parentOf(size: number, match: number): number | null {
  const r = roundOf(size, match);
  if (r === roundCount(size) - 1) return null;
  return roundOffset(size, r + 1) + Math.floor((match - roundOffset(size, r)) / 2);
}

export function entrants(size: number, participants: string[], values: (number | null)[], match: number): [number | null, number | null] {
  const r = roundOf(size, match);
  const k = match - roundOffset(size, r);
  if (r === 0) {
    const slot = (s: number) => (participants[s] ? s : BYE);
    return [slot(2 * k), slot(2 * k + 1)];
  }
  const child = roundOffset(size, r - 1) + 2 * k;
  return [values[child] ?? null, values[child + 1] ?? null];
}

export const isByeMatch = (size: number, participants: string[], match: number) =>
  roundOf(size, match) === 0 && entrants(size, participants, [], match).includes(BYE);

export const pointsFor = (size: number, match: number) => 2 ** roundOf(size, match);

/** "Finale", "Demi-finales", "Quarts", "8es", "16es" counted from the end. */
export function roundLabel(size: number, round: number): string {
  const fromEnd = roundCount(size) - 1 - round;
  return ["Finale", "Demi-finales", "Quarts de finale", "Huitièmes", "Seizièmes"][fromEnd] ?? `Tour ${round + 1}`;
}

/**
 * Makes a prediction consistent after a change: byes go through, and a pick
 * whose participant no longer reaches that match is cleared (all the way up).
 */
export function normalizePicks(size: number, participants: string[], picks: (number | null)[]): (number | null)[] {
  const out = Array.from({ length: size - 1 }, (_, i) => picks[i] ?? null);
  for (let i = 0; i < size - 1; i++) {
    const [a, b] = entrants(size, participants, out, i);
    if (a === BYE) out[i] = b;
    else if (b === BYE) out[i] = a;
    else if (out[i] !== a && out[i] !== b) out[i] = null;
  }
  return out;
}

/** Matches a player actually has to decide (byes excluded). */
export function decisions(size: number, participants: string[]) {
  let n = 0;
  for (let i = 0; i < size - 1; i++) if (!isByeMatch(size, participants, i)) n++;
  return n;
}
