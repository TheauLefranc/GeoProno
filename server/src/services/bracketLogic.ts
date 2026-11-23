/**
 * Knockout bracket maths, free of I/O so it can be unit tested.
 * Keep the structure helpers in sync with web/src/lib/bracket.ts.
 *
 * A bracket of `size` slots (power of two) has size - 1 matches, numbered
 * round by round: round 0 holds matches 0 .. size/2 - 1, round 1 the next
 * size/4, and so on up to the final (index size - 2). Match k of round r is fed
 * by matches 2k and 2k + 1 of round r - 1; in round 0 it opposes slots 2k and
 * 2k + 1. A slot left empty ("") is a bye: its opponent goes through without
 * playing, and that match is worth no points.
 *
 * Outcomes and picks are arrays indexed by match, holding the index of the
 * slot (participant) that wins it, or null when unknown.
 */

export const BRACKET_SIZES = [4, 8, 16, 32] as const;
export const BYE = -1;

export const roundCount = (size: number) => Math.log2(size);

/** First match index of a round. */
export const roundOffset = (size: number, round: number) => size - size / 2 ** round;

export function roundOf(size: number, match: number): number {
  let r = 0;
  while (match >= roundOffset(size, r + 1)) r++;
  return r;
}

/** Index of the match the winner of `match` plays next, null after the final. */
export function parentOf(size: number, match: number): number | null {
  const r = roundOf(size, match);
  if (r === roundCount(size) - 1) return null;
  const k = match - roundOffset(size, r);
  return roundOffset(size, r + 1) + Math.floor(k / 2);
}

/**
 * Who plays a match given the outcomes so far: two slot indexes, BYE for an
 * empty first-round slot, or null while the feeding match is undecided.
 */
export function entrants(size: number, participants: string[], outcomes: (number | null)[], match: number): [number | null, number | null] {
  const r = roundOf(size, match);
  const k = match - roundOffset(size, r);
  if (r === 0) {
    const slot = (s: number) => (participants[s] ? s : BYE);
    return [slot(2 * k), slot(2 * k + 1)];
  }
  const child = roundOffset(size, r - 1) + 2 * k;
  return [outcomes[child] ?? null, outcomes[child + 1] ?? null];
}

/** A first-round match against an empty slot: decided at creation, never scored. */
export const isByeMatch = (size: number, participants: string[], match: number) =>
  roundOf(size, match) === 0 && entrants(size, participants, [], match).includes(BYE);

/** Points for a correct pick: they double each round, so every round weighs the same. */
export const pointsFor = (size: number, match: number) => 2 ** roundOf(size, match);

/** Highest score reachable in this bracket (byes excluded). */
export function maxPoints(size: number, participants: string[]): number {
  let total = 0;
  for (let i = 0; i < size - 1; i++) if (!isByeMatch(size, participants, i)) total += pointsFor(size, i);
  return total;
}

/** Checks the slots: power-of-two size, unique names, no first-round match between two byes. */
export function validateParticipants(size: number, participants: string[]): string | null {
  if (!(BRACKET_SIZES as readonly number[]).includes(size)) return "Taille de tableau non prise en charge.";
  if (participants.length !== size) return "Chaque place du tableau doit être renseignée (ou laissée vide pour un exempt).";
  const names = participants.filter(Boolean).map((p) => p.trim().toLowerCase());
  if (names.length < 2) return "Il faut au moins deux participants.";
  if (new Set(names).size !== names.length) return "Deux participants portent le même nom.";
  for (let k = 0; k < size / 2; k++) {
    if (!participants[2 * k] && !participants[2 * k + 1]) return `Le match ${k + 1} du premier tour n'a aucun participant.`;
  }
  return null;
}

/** Outcomes at creation: byes decided, everything else unknown. */
export function initialOutcomes(size: number, participants: string[]): (number | null)[] {
  const out: (number | null)[] = Array(size - 1).fill(null);
  for (let k = 0; k < size / 2; k++) {
    const [a, b] = entrants(size, participants, out, k);
    if (a === BYE) out[k] = b;
    else if (b === BYE) out[k] = a;
  }
  return out;
}

/**
 * Validates a full prediction: every match picked, each pick one of the two
 * entrants implied by the earlier picks, byes fixed. Returns an error or null.
 */
export function validatePicks(size: number, participants: string[], picks: unknown): string | null {
  if (!Array.isArray(picks) || picks.length !== size - 1) return "Pronostic incomplet : choisis un vainqueur pour chaque match.";
  const forced = initialOutcomes(size, participants);
  for (let i = 0; i < size - 1; i++) {
    const p = picks[i];
    if (!Number.isInteger(p)) return "Pronostic incomplet : choisis un vainqueur pour chaque match.";
    if (forced[i] !== null && p !== forced[i]) return "Un exempt passe forcément au tour suivant.";
    const [a, b] = entrants(size, participants, picks, i);
    if (p === BYE || (p !== a && p !== b)) return "Pronostic incohérent : un vainqueur doit venir du match précédent.";
  }
  return null;
}

/** Score of a prediction against the outcomes known so far. */
export function scorePicks(size: number, participants: string[], picks: number[], outcomes: (number | null)[]): number {
  let total = 0;
  for (let i = 0; i < size - 1; i++) {
    if (isByeMatch(size, participants, i)) continue;
    if (outcomes[i] !== null && outcomes[i] !== undefined && picks[i] === outcomes[i]) total += pointsFor(size, i);
  }
  return total;
}

export interface EntryLike {
  id: string;
  amount: number;
  points: number;
}

export interface EntryResult {
  id: string;
  status: "WON" | "LOST" | "REFUNDED";
  payout: number;
}

/**
 * The whole pool is shared in proportion to stake x points: the better the
 * prediction and the bigger the stake, the bigger the share. Nobody scoring a
 * single point means everyone is refunded.
 */
export function computeBracketPayouts(entries: EntryLike[]): EntryResult[] {
  const pool = entries.reduce((s, e) => s + e.amount, 0);
  const weight = entries.reduce((s, e) => s + e.amount * e.points, 0);
  if (weight === 0) return entries.map((e) => ({ id: e.id, status: "REFUNDED", payout: e.amount }));
  return entries.map((e) =>
    e.points > 0
      ? { id: e.id, status: "WON", payout: Math.floor((pool * e.amount * e.points) / weight) }
      : { id: e.id, status: "LOST", payout: 0 },
  );
}
