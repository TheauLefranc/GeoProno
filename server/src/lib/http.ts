import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const forbidden = (msg = "Action non autorisée") => new HttpError(403, msg);
export const notFound = (msg = "Introuvable") => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({ error: first ? `${first.path.join(".") || "requête"} : ${first.message}` : "Requête invalide" });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Erreur serveur, réessaie dans un instant." });
};
