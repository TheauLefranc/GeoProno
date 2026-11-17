import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { badRequest, conflict, forbidden, notFound } from "../lib/http";
import { isStaff, type SessionUser } from "../lib/auth";
import { applyBalanceChange } from "./ledger";
import { computePayouts, poolOdds, votesNeeded } from "./payout";
import { getSettings } from "./settings";

export const CATEGORIES = ["BABYFOOT", "FOOT", "RUGBY", "BASKET", "HAND", "VOLLEY", "PINGPONG", "ESPORT", "AUTRE"] as const;
export type Category = (typeof CATEGORIES)[number];

export const betInclude = {
  creator: { select: { id: true, username: true } },
  group: { select: { id: true, name: true, ownerId: true } },
  options: { orderBy: { position: "asc" } },
  _count: { select: { votes: true } },
} satisfies Prisma.BetInclude;

type BetRow = Prisma.BetGetPayload<{ include: typeof betInclude }>;

/** Group bets are only visible to members. */
export async function assertCanSee(bet: { groupId: string | null }, user?: SessionUser) {
  if (!bet.groupId) return;
  if (!user) throw notFound("Pari introuvable");
  const m = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: bet.groupId, userId: user.id } } });
  if (!m) throw notFound("Pari introuvable");
}

/** Moderators handle global bets; the group owner handles the group's bets. */
export function canModerate(bet: { group: { ownerId: string } | null }, user?: SessionUser) {
  if (!user) return false;
  if (bet.group) return bet.group.ownerId === user.id;
  return isStaff(user);
}

export async function serializeBets(bets: BetRow[], user?: SessionUser) {
  if (bets.length === 0) return [];
  const ids = bets.map((b) => b.id);
  const [totals, mine, myVotes] = await Promise.all([
    prisma.wager.groupBy({
      by: ["betId", "optionId"],
      where: { betId: { in: ids } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    user
      ? prisma.wager.findMany({ where: { betId: { in: ids }, userId: user.id }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    user
      ? prisma.betVote.findMany({ where: { betId: { in: ids }, userId: user.id }, select: { betId: true } })
      : Promise.resolve([]),
  ]);
  const voted = new Set(myVotes.map((v) => v.betId));
  const now = Date.now();

  return bets.map((b) => {
    const optTotals: Record<string, number> = {};
    const optCounts: Record<string, number> = {};
    for (const o of b.options) {
      optTotals[o.id] = 0;
      optCounts[o.id] = 0;
    }
    for (const t of totals) {
      if (t.betId !== b.id) continue;
      optTotals[t.optionId] = t._sum.amount ?? 0;
      optCounts[t.optionId] = t._count._all;
    }
    const pOdds = poolOdds(optTotals);
    const pool = Object.values(optTotals).reduce((s, v) => s + v, 0);
    return {
      id: b.id,
      title: b.title,
      description: b.description,
      category: b.category,
      status: b.status,
      oddsEnabled: b.oddsEnabled,
      closesAt: b.closesAt,
      createdAt: b.createdAt,
      settledAt: b.settledAt,
      acceptingWagers: b.status === "OPEN" && b.closesAt.getTime() > now,
      votesRequired: b.votesRequired,
      voteCount: b._count.votes,
      myVote: voted.has(b.id),
      creator: b.creator,
      group: b.group ? { id: b.group.id, name: b.group.name } : null,
      winningOptionId: b.winningOptionId,
      canModerate: canModerate(b, user),
      pool,
      options: b.options.map((o) => ({
        id: o.id,
        label: o.label,
        odds: b.oddsEnabled ? (o.oddsX100 ?? null) : pOdds[o.id],
        total: optTotals[o.id],
        wagerCount: optCounts[o.id],
      })),
      myWagers: mine
        .filter((w) => w.betId === b.id)
        .map((w) => ({ id: w.id, optionId: w.optionId, amount: w.amount, oddsX100: w.oddsX100, status: w.status, payout: w.payout })),
    };
  });
}

export async function loadBet(id: string, user?: SessionUser) {
  const bet = await prisma.bet.findUnique({ where: { id }, include: betInclude });
  if (!bet) throw notFound("Pari introuvable");
  await assertCanSee(bet, user);
  return bet;
}

export interface NewBetInput {
  title: string;
  description?: string;
  category: Category;
  closesAt: Date;
  options: { label: string; odds?: number }[];
  oddsEnabled: boolean;
  groupId?: string;
}

export async function proposeBet(user: SessionUser, input: NewBetInput) {
  const settings = await getSettings();
  if (input.closesAt.getTime() < Date.now() + 5 * 60_000) throw badRequest("La clôture doit être au moins 5 minutes dans le futur.");
  if (input.oddsEnabled && !settings.oddsFeatureEnabled) throw badRequest("Les cotes sont désactivées par les admins.");
  if (input.oddsEnabled && input.options.some((o) => !o.odds)) throw badRequest("Donne une cote à chaque option.");
  const labels = new Set(input.options.map((o) => o.label.trim().toLowerCase()));
  if (labels.size !== input.options.length) throw badRequest("Deux options portent le même nom.");

  let memberCount: number | undefined;
  if (input.groupId) {
    const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: input.groupId, userId: user.id } } });
    if (!member) throw forbidden("Tu ne fais pas partie de ce groupe.");
    memberCount = await prisma.groupMember.count({ where: { groupId: input.groupId } });
  }
  const required = votesNeeded(settings.votesRequired, memberCount);
  const opensNow = required <= 1;

  const bet = await prisma.bet.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      closesAt: input.closesAt,
      oddsEnabled: input.oddsEnabled,
      votesRequired: required,
      status: opensNow ? "OPEN" : "PROPOSED",
      openedAt: opensNow ? new Date() : null,
      creatorId: user.id,
      groupId: input.groupId ?? null,
      options: {
        create: input.options.map((o, i) => ({
          label: o.label.trim(),
          position: i,
          oddsX100: input.oddsEnabled && o.odds ? Math.round(o.odds * 100) : null,
        })),
      },
      votes: { create: { userId: user.id } },
    },
  });
  return bet.id;
}

export async function vote(user: SessionUser, betId: string, on: boolean) {
  const bet = await loadBet(betId, user);
  if (bet.status !== "PROPOSED") throw conflict("Ce pari n'est plus en phase de vote.");
  if (bet.closesAt.getTime() <= Date.now()) throw conflict("Ce pari a expiré avant d'être validé.");
  if (on) {
    await prisma.betVote.upsert({
      where: { betId_userId: { betId, userId: user.id } },
      update: {},
      create: { betId, userId: user.id },
    });
    const count = await prisma.betVote.count({ where: { betId } });
    if (count >= bet.votesRequired) {
      await prisma.bet.updateMany({ where: { id: betId, status: "PROPOSED" }, data: { status: "OPEN", openedAt: new Date() } });
    }
  } else {
    if (bet.creatorId === user.id) throw conflict("Tu ne peux pas retirer ton vote sur ton propre pari.");
    await prisma.betVote.deleteMany({ where: { betId, userId: user.id } });
  }
}

export async function placeWager(user: SessionUser, betId: string, optionId: string, amount: number) {
  const settings = await getSettings();
  if (!Number.isInteger(amount) || amount < settings.minStake) throw badRequest(`Mise minimum : ${settings.minStake}.`);
  if (amount > settings.maxStake) throw badRequest(`Mise maximum : ${settings.maxStake}.`);
  const bet = await loadBet(betId, user);
  if (bet.status !== "OPEN") throw conflict("Ce pari n'est pas ouvert.");
  if (bet.closesAt.getTime() <= Date.now()) throw conflict("Les mises sont fermées pour ce pari.");
  const option = bet.options.find((o) => o.id === optionId);
  if (!option) throw badRequest("Option inconnue.");
  if (bet.oddsEnabled && !option.oddsX100) throw conflict("Cette option n'a pas encore de cote.");

  return prisma.$transaction(async (tx) => {
    const wager = await tx.wager.create({
      data: { betId, optionId, userId: user.id, amount, oddsX100: bet.oddsEnabled ? option.oddsX100 : null },
    });
    const balance = await applyBalanceChange(tx, {
      userId: user.id,
      amount: -amount,
      type: "BET_STAKE",
      betId,
      note: `${bet.title} · ${option.label}`,
    });
    return { wagerId: wager.id, balance };
  });
}

export async function setStatusFromModeration(user: SessionUser, betId: string, action: "approve" | "reject") {
  const bet = await loadBet(betId, user);
  if (!canModerate(bet, user)) throw forbidden();
  if (bet.status !== "PROPOSED") throw conflict("Ce pari n'est plus en phase de vote.");
  if (action === "approve" && bet.oddsEnabled && bet.options.some((o) => !o.oddsX100)) {
    throw conflict("Fixe une cote pour chaque option avant d'ouvrir le pari.");
  }
  await prisma.bet.update({
    where: { id: betId },
    data: action === "approve" ? { status: "OPEN", openedAt: new Date() } : { status: "REJECTED" },
  });
}

export async function updateOdds(user: SessionUser, betId: string, oddsEnabled: boolean, odds: Record<string, number>) {
  const settings = await getSettings();
  const bet = await loadBet(betId, user);
  if (!canModerate(bet, user)) throw forbidden();
  if (bet.status !== "PROPOSED" && bet.status !== "OPEN") throw conflict("Ce pari est terminé.");
  if (oddsEnabled && !settings.oddsFeatureEnabled) throw badRequest("Les cotes sont désactivées par les admins.");
  if (oddsEnabled !== bet.oddsEnabled) {
    const wagers = await prisma.wager.count({ where: { betId } });
    if (wagers > 0) throw conflict("Impossible de changer de mode : des mises sont déjà placées.");
  }
  if (oddsEnabled && bet.options.some((o) => !odds[o.id] && !o.oddsX100)) throw badRequest("Donne une cote à chaque option.");
  await prisma.$transaction([
    prisma.bet.update({ where: { id: betId }, data: { oddsEnabled } }),
    ...bet.options.map((o) =>
      prisma.betOption.update({
        where: { id: o.id },
        data: { oddsX100: oddsEnabled ? (odds[o.id] ? Math.round(odds[o.id] * 100) : o.oddsX100) : null },
      }),
    ),
  ]);
}

export async function settleBet(user: SessionUser, betId: string, winningOptionId: string) {
  const bet = await loadBet(betId, user);
  if (!canModerate(bet, user)) throw forbidden();
  if (bet.status !== "OPEN") throw conflict("Seul un pari ouvert peut être réglé.");
  const option = bet.options.find((o) => o.id === winningOptionId);
  if (!option) throw badRequest("Option inconnue.");

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.bet.updateMany({
      where: { id: betId, status: "OPEN" },
      data: { status: "SETTLED", settledAt: new Date(), winningOptionId },
    });
    if (claimed.count === 0) throw conflict("Ce pari vient d'être réglé par quelqu'un d'autre.");
    const wagers = await tx.wager.findMany({ where: { betId, status: "PENDING" } });
    const results = computePayouts(bet.oddsEnabled, wagers, winningOptionId);
    for (const r of results) {
      const w = wagers.find((x) => x.id === r.id)!;
      await tx.wager.update({ where: { id: r.id }, data: { status: r.status, payout: r.payout } });
      if (r.payout > 0) {
        await applyBalanceChange(tx, {
          userId: w.userId,
          amount: r.payout,
          type: r.status === "REFUNDED" ? "BET_REFUND" : "BET_PAYOUT",
          betId,
          note: r.status === "REFUNDED" ? `${bet.title} · personne n'avait le bon résultat` : `${bet.title} · ${option.label}`,
        });
      }
    }
  });
}

export async function cancelBet(user: SessionUser, betId: string) {
  const bet = await loadBet(betId, user);
  const ownProposal = bet.status === "PROPOSED" && bet.creatorId === user.id;
  if (!canModerate(bet, user) && !ownProposal) throw forbidden();
  if (bet.status !== "PROPOSED" && bet.status !== "OPEN") throw conflict("Ce pari est déjà terminé.");

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.bet.updateMany({
      where: { id: betId, status: { in: ["PROPOSED", "OPEN"] } },
      data: { status: "CANCELLED", settledAt: new Date() },
    });
    if (claimed.count === 0) throw conflict("Ce pari vient d'être modifié.");
    const wagers = await tx.wager.findMany({ where: { betId, status: "PENDING" } });
    for (const w of wagers) {
      await tx.wager.update({ where: { id: w.id }, data: { status: "REFUNDED", payout: w.amount } });
      await applyBalanceChange(tx, { userId: w.userId, amount: w.amount, type: "BET_REFUND", betId, note: `${bet.title} · annulé` });
    }
  });
}
