import type { Match, Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { badRequest, conflict, notFound } from "../lib/http";
import type { SessionUser } from "../lib/auth";
import { cancelBet, settleBet } from "./bets";
import { getSettings } from "./settings";

const DAY = 24 * 3600_000;

export const matchInclude = {
  bet: {
    select: {
      id: true,
      status: true,
      opensAt: true,
      closesAt: true,
      oddsEnabled: true,
      options: { orderBy: { position: "asc" }, select: { id: true, label: true, oddsX100: true } },
    },
  },
} satisfies Prisma.MatchInclude;

type MatchRow = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

export function serializeMatch(m: MatchRow) {
  const now = Date.now();
  const bet = m.bet;
  return {
    id: m.id,
    category: m.category,
    homeName: m.homeName,
    awayName: m.awayName,
    location: m.location,
    startsAt: m.startsAt,
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    liveNote: m.liveNote,
    updatedAt: m.updatedAt,
    bet: bet
      ? {
          id: bet.id,
          status: bet.status,
          opensAt: bet.opensAt,
          closesAt: bet.closesAt,
          oddsEnabled: bet.oddsEnabled,
          acceptingWagers:
            bet.status === "OPEN" && bet.closesAt.getTime() > now && (!bet.opensAt || bet.opensAt.getTime() <= now),
          options: bet.options.map((o) => ({ id: o.id, label: o.label, odds: o.oddsX100 })),
        }
      : null,
  };
}

export interface MatchInput {
  category: string;
  homeName: string;
  awayName: string;
  location?: string;
  startsAt: Date;
  withBet: boolean;
  allowDraw: boolean;
  oddsEnabled: boolean;
  odds?: { home?: number; draw?: number; away?: number };
}

/** Creates the fixture and, if asked, its bet: no community vote, opens N days before kick-off. */
export async function createMatch(user: SessionUser, input: MatchInput) {
  if (input.startsAt.getTime() < Date.now() - 6 * 3600_000) throw badRequest("Ce match est déjà passé.");
  const settings = await getSettings();
  if (input.withBet && input.oddsEnabled) {
    if (!settings.oddsFeatureEnabled) throw badRequest("Les cotes sont désactivées dans les réglages.");
    const o = input.odds ?? {};
    if (!o.home || !o.away || (input.allowDraw && !o.draw)) throw badRequest("Donne une cote à chaque issue.");
  }

  return prisma.$transaction(async (tx) => {
    let betFields: Partial<Match> = {};
    if (input.withBet) {
      const opensAt = new Date(Math.max(Date.now(), input.startsAt.getTime() - settings.betOpenDays * DAY));
      const x100 = (v?: number) => (input.oddsEnabled && v ? Math.round(v * 100) : null);
      const labels: [string, number | null][] = [
        [input.homeName, x100(input.odds?.home)],
        ...(input.allowDraw ? ([["Match nul", x100(input.odds?.draw)]] as [string, number | null][]) : []),
        [input.awayName, x100(input.odds?.away)],
      ];
      const bet = await tx.bet.create({
        data: {
          title: `${input.homeName} contre ${input.awayName}`,
          description: input.location ? `Lieu : ${input.location}` : null,
          category: input.category,
          status: "OPEN",
          openedAt: new Date(),
          opensAt,
          closesAt: input.startsAt,
          oddsEnabled: input.oddsEnabled,
          votesRequired: 0,
          creatorId: user.id,
          options: { create: labels.map(([label, oddsX100], position) => ({ label, position, oddsX100 })) },
        },
        include: { options: { orderBy: { position: "asc" } } },
      });
      const [home, ...rest] = bet.options;
      const away = rest[rest.length - 1];
      betFields = {
        betId: bet.id,
        homeOptionId: home.id,
        awayOptionId: away.id,
        drawOptionId: input.allowDraw ? rest[0].id : null,
      };
    }
    return tx.match.create({
      data: {
        category: input.category,
        homeName: input.homeName,
        awayName: input.awayName,
        location: input.location || null,
        startsAt: input.startsAt,
        createdById: user.id,
        ...betFields,
      },
    });
  });
}

async function load(id: string) {
  const m = await prisma.match.findUnique({ where: { id }, include: matchInclude });
  if (!m) throw notFound("Match introuvable");
  return m;
}

/** Reschedule / rename before kick-off; the bet window follows. */
export async function updateMatch(id: string, patch: { homeName?: string; awayName?: string; location?: string | null; startsAt?: Date }) {
  const m = await load(id);
  if (m.status !== "SCHEDULED") throw conflict("On ne peut modifier qu'un match pas encore commencé.");
  const settings = await getSettings();
  await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id }, data: patch });
    if (m.bet && m.bet.status === "OPEN") {
      const startsAt = patch.startsAt ?? m.startsAt;
      const data: Prisma.BetUpdateInput = {
        closesAt: startsAt,
        opensAt: new Date(Math.max(Date.now(), startsAt.getTime() - settings.betOpenDays * DAY)),
        title: `${patch.homeName ?? m.homeName} contre ${patch.awayName ?? m.awayName}`,
      };
      // Keep an already-open window open even if the match moves later.
      if (m.bet.opensAt && m.bet.opensAt.getTime() <= Date.now()) delete data.opensAt;
      await tx.bet.update({ where: { id: m.bet.id }, data });
      if (patch.homeName && m.homeOptionId) await tx.betOption.update({ where: { id: m.homeOptionId }, data: { label: patch.homeName } });
      if (patch.awayName && m.awayOptionId) await tx.betOption.update({ where: { id: m.awayOptionId }, data: { label: patch.awayName } });
    }
  });
}

/** Live score update. Going live closes betting immediately. */
export async function setScore(id: string, s: { homeScore: number; awayScore: number; liveNote?: string | null; live?: boolean }) {
  const m = await load(id);
  if (m.status === "FINISHED" || m.status === "CANCELLED") throw conflict("Ce match est terminé.");
  const goLive = s.live || m.status === "LIVE";
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id },
      data: { homeScore: s.homeScore, awayScore: s.awayScore, liveNote: s.liveNote ?? m.liveNote, status: goLive ? "LIVE" : m.status },
    });
    if (goLive && m.bet && m.bet.status === "OPEN" && m.bet.closesAt.getTime() > Date.now()) {
      await tx.bet.update({ where: { id: m.bet.id }, data: { closesAt: new Date() } });
    }
  });
}

/** Final whistle: records the score and settles the bet from it. */
export async function finishMatch(user: SessionUser, id: string, homeScore: number, awayScore: number) {
  const m = await load(id);
  if (m.status === "FINISHED" || m.status === "CANCELLED") throw conflict("Ce match est déjà terminé.");
  await prisma.match.update({ where: { id }, data: { status: "FINISHED", homeScore, awayScore, liveNote: null } });
  if (!m.bet || m.bet.status !== "OPEN") return { settled: false };
  if (m.bet.closesAt.getTime() > Date.now()) await prisma.bet.update({ where: { id: m.bet.id }, data: { closesAt: new Date() } });

  const winner = homeScore > awayScore ? m.homeOptionId : awayScore > homeScore ? m.awayOptionId : m.drawOptionId;
  if (winner) {
    await settleBet(user, m.bet.id, winner);
    return { settled: true };
  }
  // Draw with no "match nul" option: nobody can win, refund everyone.
  await cancelBet(user, m.bet.id);
  return { settled: false, refunded: true };
}

export async function cancelMatch(user: SessionUser, id: string) {
  const m = await load(id);
  if (m.status === "FINISHED") throw conflict("Ce match est déjà terminé.");
  await prisma.match.update({ where: { id }, data: { status: "CANCELLED", liveNote: null } });
  if (m.bet && (m.bet.status === "OPEN" || m.bet.status === "PROPOSED")) await cancelBet(user, m.bet.id);
}

export { load as loadMatch };
