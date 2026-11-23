import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "../lib/db";
import { badRequest, conflict, forbidden, notFound } from "../lib/http";
import type { SessionUser } from "../lib/auth";
import { cancelLoadedBet, loadBet } from "./bets";
import { canManageCategory, isScopedManager } from "./categories";
import {
  BYE,
  computeBracketPayouts,
  entrants,
  initialOutcomes,
  isByeMatch,
  maxPoints,
  parentOf,
  scorePicks,
  validateParticipants,
  validatePicks,
} from "./bracketLogic";
import { applyBalanceChange } from "./ledger";
import { getSettings } from "./settings";

/** Label of the single option every bracket wager is placed on. */
const ENTRY_OPTION = "Pronostic complet";

export const bracketInclude = {
  createdBy: { select: { id: true, username: true } },
  bet: { select: { id: true, status: true, closesAt: true, settledAt: true, options: { select: { id: true } } } },
  entries: {
    select: {
      id: true,
      picks: true,
      userId: true,
      user: { select: { username: true } },
      wager: { select: { amount: true, payout: true, status: true } },
    },
  },
} satisfies Prisma.BracketInclude;

type BracketRow = Prisma.BracketGetPayload<{ include: typeof bracketInclude }>;

export type BracketState = "OPEN" | "LOCKED" | "SETTLED" | "CANCELLED";

function stateOf(b: BracketRow, now = Date.now()): BracketState {
  if (b.bet.status === "SETTLED") return "SETTLED";
  if (b.bet.status === "CANCELLED") return "CANCELLED";
  return b.bet.closesAt.getTime() > now ? "OPEN" : "LOCKED";
}

const outcomesOf = (b: { outcomes: Prisma.JsonValue }) => b.outcomes as (number | null)[];
const scoresOf = (b: { scores: Prisma.JsonValue }) => b.scores as (string | null)[];

/**
 * Other players' predictions stay hidden until the lock, so nobody can copy
 * the best bracket at the last minute; after it, everyone sees the standings.
 */
export function serializeBracket(b: BracketRow, user?: SessionUser, detail = false) {
  const state = stateOf(b);
  const outcomes = outcomesOf(b);
  const score = (picks: Prisma.JsonValue) => scorePicks(b.size, b.participants, picks as number[], outcomes);
  const mine = user ? b.entries.find((e) => e.userId === user.id) : undefined;
  const pool = b.entries.reduce((s, e) => s + e.wager.amount, 0);
  return {
    id: b.id,
    title: b.title,
    category: b.category,
    size: b.size,
    participants: b.participants,
    outcomes,
    scores: scoresOf(b),
    state,
    locksAt: b.bet.closesAt,
    settledAt: b.bet.settledAt,
    createdAt: b.createdAt,
    createdBy: b.createdBy,
    betId: b.bet.id,
    pool,
    entryCount: b.entries.length,
    maxPoints: maxPoints(b.size, b.participants),
    canManage: canManageCategory(user, b.category),
    /** A sport manager running this sport may not bet on it (conflict of interest). */
    canEnter: !(isScopedManager(user) && canManageCategory(user, b.category)),
    myEntry: mine
      ? { picks: mine.picks as number[], amount: mine.wager.amount, points: score(mine.picks), payout: mine.wager.payout, status: mine.wager.status }
      : null,
    standings:
      detail && state !== "OPEN"
        ? b.entries
            .map((e) => ({
              userId: e.userId,
              username: e.user.username,
              amount: e.wager.amount,
              points: score(e.picks),
              payout: e.wager.payout,
              status: e.wager.status,
              picks: e.picks as number[],
            }))
            .sort((x, y) => y.points - x.points || y.amount - x.amount || x.username.localeCompare(y.username))
        : null,
  };
}

export async function loadBracket(id: string) {
  const b = await prisma.bracket.findUnique({ where: { id }, include: bracketInclude });
  if (!b) throw notFound("Tableau introuvable");
  return b;
}

export async function listBrackets(view: "active" | "done") {
  return prisma.bracket.findMany({
    where: view === "active" ? { bet: { status: "OPEN" } } : { bet: { status: { in: ["SETTLED", "CANCELLED"] } } },
    orderBy: view === "active" ? { bet: { closesAt: "asc" } } : { bet: { settledAt: "desc" } },
    include: bracketInclude,
    take: 50,
  });
}

export interface NewBracketInput {
  title: string;
  category: string;
  size: number;
  participants: string[];
  locksAt: Date;
}

const cleanSlots = (participants: string[]) => participants.map((p) => p.trim());

export async function createBracket(user: SessionUser, input: NewBracketInput) {
  if (!canManageCategory(user, input.category)) throw forbidden("Tu ne gères pas ce sport.");
  const participants = cleanSlots(input.participants);
  const error = validateParticipants(input.size, participants);
  if (error) throw badRequest(error);
  if (input.locksAt.getTime() < Date.now() + 5 * 60_000) throw badRequest("La fin des pronostics doit être au moins 5 minutes dans le futur.");

  return prisma.$transaction(async (tx) => {
    const bet = await tx.bet.create({
      data: {
        title: `Tableau · ${input.title}`,
        category: input.category,
        status: "OPEN",
        openedAt: new Date(),
        closesAt: input.locksAt,
        votesRequired: 0,
        creatorId: user.id,
        options: { create: [{ label: ENTRY_OPTION, position: 0 }] },
      },
    });
    return tx.bracket.create({
      data: {
        title: input.title,
        category: input.category,
        size: input.size,
        participants,
        outcomes: initialOutcomes(input.size, participants),
        scores: Array(input.size - 1).fill(null),
        createdById: user.id,
        betId: bet.id,
      },
    });
  });
}

/** Locks the Bet row: entries, results and settlement all serialize on it. */
async function lockBet(tx: Tx, betId: string) {
  const [row] = await tx.$queryRaw<{ status: string; closesAt: Date }[]>`
    SELECT "status", "closesAt" FROM "Bet" WHERE "id" = ${betId} FOR UPDATE`;
  return row;
}

/**
 * Renames participants, the title or moves the lock before it passes. Byes can
 * only move while nobody has played: picks are stored by slot.
 */
export async function updateBracket(user: SessionUser, id: string, patch: { title?: string; participants?: string[]; locksAt?: Date }) {
  const b = await loadBracket(id);
  if (!canManageCategory(user, b.category)) throw forbidden("Tu ne gères pas ce sport.");
  if (stateOf(b) !== "OPEN") throw conflict("Les pronostics sont fermés : le tableau ne peut plus changer.");
  let participants: string[] | undefined;
  if (patch.participants) {
    participants = cleanSlots(patch.participants);
    if (participants.length !== b.size) throw badRequest("La taille du tableau ne peut pas changer.");
    const error = validateParticipants(b.size, participants);
    if (error) throw badRequest(error);
    const sameByes = participants.every((p, i) => !p === !b.participants[i]);
    if (!sameByes && b.entries.length > 0) throw conflict("Des pronostics existent déjà : tu peux renommer, pas déplacer les exempts.");
  }
  if (patch.locksAt && patch.locksAt.getTime() < Date.now() + 60_000) throw badRequest("La fin des pronostics doit être dans le futur.");

  await prisma.$transaction([
    prisma.bracket.update({
      where: { id },
      data: {
        ...(patch.title ? { title: patch.title } : {}),
        ...(participants ? { participants, outcomes: initialOutcomes(b.size, participants) } : {}),
      },
    }),
    prisma.bet.update({
      where: { id: b.betId },
      data: { ...(patch.title ? { title: `Tableau · ${patch.title}` } : {}), ...(patch.locksAt ? { closesAt: patch.locksAt } : {}) },
    }),
  ]);
}

/**
 * Creates or updates the player's prediction. The stake is debited once, on
 * the first save; afterwards only the picks change, until the lock.
 */
export async function saveEntry(user: SessionUser, id: string, picks: unknown, amount?: number) {
  const b = await loadBracket(id);
  if (stateOf(b) !== "OPEN") throw conflict("Les pronostics sont fermés pour ce tableau.");
  if (isScopedManager(user) && canManageCategory(user, b.category)) {
    throw forbidden("Tu gères ce sport : tu ne peux pas parier sur ce tableau.");
  }
  const error = validatePicks(b.size, b.participants, picks);
  if (error) throw badRequest(error);
  const existing = b.entries.find((e) => e.userId === user.id);
  const settings = await getSettings();
  if (!existing) {
    if (amount === undefined || !Number.isInteger(amount) || amount < settings.minStake) throw badRequest(`Mise minimum : ${settings.minStake}.`);
    if (amount > settings.maxStake) throw badRequest(`Mise maximum : ${settings.maxStake}.`);
  }

  return prisma.$transaction(async (tx) => {
    const locked = await lockBet(tx, b.betId);
    if (!locked || locked.status !== "OPEN" || locked.closesAt.getTime() <= Date.now()) {
      throw conflict("Les pronostics viennent de fermer pour ce tableau.");
    }
    const current = await tx.bracketEntry.findUnique({ where: { bracketId_userId: { bracketId: id, userId: user.id } } });
    if (current) {
      await tx.bracketEntry.update({ where: { id: current.id }, data: { picks: picks as number[] } });
      return { created: false };
    }
    const wager = await tx.wager.create({
      data: { betId: b.betId, optionId: b.bet.options[0].id, userId: user.id, amount: amount! },
    });
    await tx.bracketEntry.create({ data: { bracketId: id, userId: user.id, wagerId: wager.id, picks: picks as number[] } });
    await applyBalanceChange(tx, { userId: user.id, amount: -amount!, type: "BET_STAKE", betId: b.betId, note: `Tableau · ${b.title}` });
    return { created: true };
  });
}

/** Closes predictions right away (the first match is about to start). */
export async function lockBracket(user: SessionUser, id: string) {
  const b = await loadBracket(id);
  if (!canManageCategory(user, b.category)) throw forbidden("Tu ne gères pas ce sport.");
  if (stateOf(b) !== "OPEN") throw conflict("Les pronostics sont déjà fermés.");
  await prisma.bet.updateMany({ where: { id: b.betId, status: "OPEN" }, data: { closesAt: new Date() } });
}

/**
 * Records (or clears, with winner = null) the winner of one match. Entering a
 * result closes predictions at once. A result can only be changed while the
 * next match is undecided. The final's result settles the whole bracket.
 */
export async function setResult(user: SessionUser, id: string, match: number, winner: number | null, score?: string | null) {
  const b = await loadBracket(id);
  if (!canManageCategory(user, b.category)) throw forbidden("Tu ne gères pas ce sport.");
  if (!Number.isInteger(match) || match < 0 || match >= b.size - 1) throw badRequest("Match inconnu.");
  if (isByeMatch(b.size, b.participants, match)) throw conflict("Ce match est un exempt : le qualifié est déjà connu.");

  return prisma.$transaction(async (tx) => {
    const locked = await lockBet(tx, b.betId);
    if (!locked || locked.status !== "OPEN") throw conflict("Ce tableau est terminé.");
    // Re-read inside the lock: two managers may be entering results at once.
    const fresh = await tx.bracket.findUniqueOrThrow({ where: { id } });
    const outcomes = [...outcomesOf(fresh)];
    const scores = [...scoresOf(fresh)];
    const parent = parentOf(b.size, match);
    if (parent !== null && outcomes[parent] !== null) throw conflict("Annule d'abord le résultat du match suivant.");
    if (winner !== null) {
      const [x, y] = entrants(b.size, b.participants, outcomes, match);
      if (x === null || y === null) throw conflict("Les deux qualifiés de ce match ne sont pas encore connus.");
      if (winner === BYE || (winner !== x && winner !== y)) throw badRequest("Ce participant ne joue pas ce match.");
    }
    outcomes[match] = winner;
    scores[match] = winner === null ? null : score?.trim() || null;

    if (locked.closesAt.getTime() > Date.now()) await tx.bet.update({ where: { id: b.betId }, data: { closesAt: new Date() } });
    await tx.bracket.update({ where: { id }, data: { outcomes, scores } });
    if (parent === null && winner !== null) {
      await settle(tx, b, outcomes);
      return { settled: true };
    }
    return { settled: false };
  });
}

/** Pays the pool out by stake x points. Runs inside setResult's transaction and lock. */
async function settle(tx: Tx, b: BracketRow, outcomes: (number | null)[]) {
  await tx.bet.update({
    where: { id: b.betId },
    data: { status: "SETTLED", settledAt: new Date(), winningOptionId: b.bet.options[0].id },
  });
  const entries = await tx.bracketEntry.findMany({ where: { bracketId: b.id }, include: { wager: true } });
  const pending = entries.filter((e) => e.wager.status === "PENDING");
  const results = computeBracketPayouts(
    pending.map((e) => ({ id: e.wager.id, amount: e.wager.amount, points: scorePicks(b.size, b.participants, e.picks as number[], outcomes) })),
  );
  for (const r of results) {
    const entry = pending.find((e) => e.wager.id === r.id)!;
    await tx.wager.update({ where: { id: r.id }, data: { status: r.status, payout: r.payout } });
    if (r.payout > 0) {
      await applyBalanceChange(tx, {
        userId: entry.userId,
        amount: r.payout,
        type: r.status === "REFUNDED" ? "BET_REFUND" : "BET_PAYOUT",
        betId: b.betId,
        note: r.status === "REFUNDED" ? `Tableau · ${b.title} · personne n'a marqué de point` : `Tableau · ${b.title}`,
      });
    }
  }
}

/** Cancels the bracket: every stake is refunded. */
export async function cancelBracket(user: SessionUser, id: string) {
  const b = await loadBracket(id);
  if (!canManageCategory(user, b.category)) throw forbidden("Tu ne gères pas ce sport.");
  await cancelLoadedBet(await loadBet(b.betId));
}
