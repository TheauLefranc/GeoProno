export { categoryLabel, categoryPath } from "./categories";

const nf = new Intl.NumberFormat("fr-FR");
/** Name of the play-money currency, used everywhere in the UI. */
export const CURRENCY = "GeoPuntos";

export const coins = (n: number) => nf.format(n);
export const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + nf.format(Math.abs(n));

/** 185 -> "1.85" ; dot kept on purpose: it reads like a scoreboard and is the odds convention. */
export const odds = (x100: number | null | undefined) => (x100 ? (x100 / 100).toFixed(2) : "—");

export type OddsTier = "fav" | "even" | "long";

/**
 * Reading of an odds value, Polymarket-style: implied probability (1 / odds)
 * drives both the colour tier and the numeral size of an option.
 *  - fav  (≥ 60 %, odds ≤ 1.66): court blue
 *  - even (33–60 %):              LED gold
 *  - long (< 33 %, odds > 3):     outsider orange
 */
export function oddsInfo(x100: number | null | undefined): { p: number; pct: number; tier: OddsTier; tierLabel: string } | null {
  if (!x100) return null;
  const p = Math.min(1, 100 / x100);
  const tier: OddsTier = p >= 0.6 ? "fav" : p >= 0.33 ? "even" : "long";
  return { p, pct: Math.round(p * 100), tier, tierLabel: tier === "fav" ? "favori" : tier === "long" ? "outsider" : "serré" };
}

export function countdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}J ${p(h)}H`;
  if (h > 0) return `${p(h)}:${p(m)}:${p(sec)}`;
  return `${p(m)}:${p(sec)}`;
}

const dtf = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const when = (iso: string) => dtf.format(new Date(iso));

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
export function ago(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
