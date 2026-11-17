/**
 * Development seed: SYNTHETIC demo data only (fake students, fake matches).
 * Never run against production. All accounts use the password "motdepasse".
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const H = 3600_000;

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed refusé en production.");
  const hash = await bcrypt.hash("motdepasse", 10);
  const names = ["camille", "hugo", "lea", "max", "ines", "theo", "sarah", "nathan", "jade", "lucas", "chloe", "yanis"];
  const users = [];
  for (const [i, n] of names.entries()) {
    users.push(
      await prisma.user.upsert({
        where: { email: `${n}@demo.local` },
        update: {},
        create: {
          email: `${n}@demo.local`,
          username: n.charAt(0).toUpperCase() + n.slice(1),
          passwordHash: hash,
          role: i === 0 ? "ADMIN" : i === 1 ? "MODERATOR" : "USER",
          balance: 1000,
          transactions: { create: { type: "SIGNUP_BONUS", amount: 1000, balanceAfter: 1000, note: "Bienvenue sur GeoProno" } },
        },
      }),
    );
  }
  await prisma.appSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const now = Date.now();
  const mk = async (data: {
    title: string;
    category: string;
    closesIn: number;
    status: "OPEN" | "PROPOSED";
    options: [string, number?][];
    odds?: boolean;
    voters?: number;
    creator?: number;
  }) => {
    const exists = await prisma.bet.findFirst({ where: { title: data.title } });
    if (exists) return exists;
    return prisma.bet.create({
      data: {
        title: data.title,
        category: data.category,
        closesAt: new Date(now + data.closesIn),
        status: data.status,
        openedAt: data.status === "OPEN" ? new Date() : null,
        oddsEnabled: !!data.odds,
        votesRequired: 10,
        creatorId: users[data.creator ?? 2].id,
        options: {
          create: data.options.map(([label, odds], i) => ({ label, position: i, oddsX100: data.odds && odds ? Math.round(odds * 100) : null })),
        },
        votes: { create: users.slice(0, data.voters ?? 10).map((u) => ({ userId: u.id })) },
      },
      include: { options: true },
    });
  };

  await mk({ title: "Finale du tournoi de baby-foot du foyer", category: "BABYFOOT", closesIn: 0.25 * H, status: "OPEN", options: [["Léa & Hugo", 1.65], ["Max & Inès", 2.4]], odds: true });
  await mk({ title: "Géo contre Mines — rugby inter-écoles", category: "RUGBY", closesIn: 50 * H, status: "OPEN", options: [["Géo"], ["Mines"]] });
  await mk({ title: "Match de foot 1A contre 2A", category: "FOOT", closesIn: 26 * H, status: "OPEN", options: [["1A", 2.1], ["Nul", 3.2], ["2A", 2.8]], odds: true });
  await mk({ title: "Le prof de pétro arrive en retard lundi ?", category: "AUTRE", closesIn: 70 * H, status: "PROPOSED", options: [["Oui"], ["Non"]], voters: 7, creator: 0 });
  await mk({ title: "Qui gagne le tournoi de ping-pong du BDE ?", category: "PINGPONG", closesIn: 120 * H, status: "PROPOSED", options: [["Théo"], ["Sarah"], ["Nathan"], ["Jade"]], voters: 3, creator: 5 });

  console.log(`Seed OK : ${users.length} comptes de démo (mot de passe « motdepasse »).`);
}

main().finally(() => prisma.$disconnect());
