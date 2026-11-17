import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { prisma } from "./lib/db";
import { errorHandler } from "./lib/http";
import { loadUser } from "./lib/auth";
import { authRouter } from "./routes/auth";
import { betsRouter } from "./routes/bets";
import { meRouter } from "./routes/me";
import { leaderboardRouter } from "./routes/leaderboard";
import { groupsRouter } from "./routes/groups";
import { adminRouter } from "./routes/admin";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(loadUser);

  app.get("/api/health", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/bets", betsRouter);
  app.use("/api/me", meRouter);
  app.use("/api/leaderboard", leaderboardRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Route inconnue" });
  });

  app.use(errorHandler);
  return app;
}
