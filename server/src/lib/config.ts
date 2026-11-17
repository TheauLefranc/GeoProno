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
  /**
   * "auto" (default): Secure cookie only when the request arrived over HTTPS
   * (directly or via a proxy's X-Forwarded-Proto). A Secure cookie on a plain-HTTP
   * site is silently dropped by browsers, which logs everyone out instantly.
   */
  cookieSecure: (["true", "false"].includes(process.env.COOKIE_SECURE ?? "") ? process.env.COOKIE_SECURE : "auto") as
    | "true"
    | "false"
    | "auto",
};

if (isProd && config.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters in production");
}
