/** Pure betting maths, kept free of I/O so it can be unit tested. */

export interface WagerLike {
  id: string;
  optionId: string;
  amount: number;
  oddsX100: number | null;
}

export interface WagerResult {
  id: string;
  status: "WON" | "LOST" | "REFUNDED";
  payout: number;
}

/**
 * Fixed odds: a winner gets stake x locked odds.
 * Pool (pari-mutuel): winners share the whole pool in proportion to their stake.
 * If nobody backed the winning option in a pool, everyone is refunded.
 */
export function computePayouts(oddsEnabled: boolean, wagers: WagerLike[], winningOptionId: string): WagerResult[] {
  if (oddsEnabled) {
    return wagers.map((w) =>
      w.optionId === winningOptionId
        ? { id: w.id, status: "WON", payout: Math.floor((w.amount * (w.oddsX100 ?? 100)) / 100) }
        : { id: w.id, status: "LOST", payout: 0 },
    );
  }
  const pool = wagers.reduce((s, w) => s + w.amount, 0);
  const winningStake = wagers.filter((w) => w.optionId === winningOptionId).reduce((s, w) => s + w.amount, 0);
  if (winningStake === 0) {
    return wagers.map((w) => ({ id: w.id, status: "REFUNDED", payout: w.amount }));
  }
  return wagers.map((w) =>
    w.optionId === winningOptionId
      ? { id: w.id, status: "WON", payout: Math.floor((w.amount * pool) / winningStake) }
      : { id: w.id, status: "LOST", payout: 0 },
  );
}

/** Indicative pool odds per option (x100), null when nobody backed it yet. */
export function poolOdds(totals: Record<string, number>): Record<string, number | null> {
  const pool = Object.values(totals).reduce((s, v) => s + v, 0);
  const out: Record<string, number | null> = {};
  for (const [id, t] of Object.entries(totals)) out[id] = t > 0 ? Math.floor((pool * 100) / t) : null;
  return out;
}

/** Votes needed to open a bet. Group bets scale down to half the group (at least 1). */
export function votesNeeded(globalVotes: number, groupMemberCount?: number): number {
  if (groupMemberCount === undefined) return Math.max(1, globalVotes);
  return Math.max(1, Math.min(globalVotes, Math.ceil(groupMemberCount / 2)));
}

/** Balance after the daily refill: tops up to the threshold, never takes coins away. */
export function refilledBalance(balance: number, threshold: number): number {
  return balance < threshold ? threshold : balance;
}

/** "YYYY-MM-DD" and hour of a date in the given IANA timezone. */
export function localDateParts(date: Date, timeZone: string): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}
