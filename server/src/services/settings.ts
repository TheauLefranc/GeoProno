import type { AppSettings } from "@prisma/client";
import { prisma } from "../lib/db";

export async function getSettings(): Promise<AppSettings> {
  return prisma.appSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}
