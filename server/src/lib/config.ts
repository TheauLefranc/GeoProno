function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const isProd = process.env.NODE_ENV === "production";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  isProd,
  jwtSecret: process.env.JWT_SECRET ?? (isProd ? "" : "dev-secret-change-me"),
  /** Email domains allowed to sign up, e.g. "ecole.fr,etu.ecole.fr". Empty = any domain. */
  allowedEmailDomains: list(process.env.ALLOWED_EMAIL_DOMAINS),
  /** Emails promoted to ADMIN when they sign up. */
  adminEmails: list(process.env.ADMIN_EMAILS),
  timezone: process.env.TZ_REFILL ?? "Europe/Paris",
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProd,
};

if (isProd && config.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters in production");
}
