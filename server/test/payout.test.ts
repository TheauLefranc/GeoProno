import { describe, expect, it } from "vitest";
import { computePayouts, localDateParts, poolOdds, refilledBalance, votesNeeded } from "../src/services/payout";

const w = (id: string, optionId: string, amount: number, oddsX100: number | null = null) => ({ id, optionId, amount, oddsX100 });

describe("computePayouts — cotes fixes", () => {
  it("paie mise x cote verrouillée aux gagnants, 0 aux perdants", () => {
    const res = computePayouts(true, [w("1", "A", 100, 185), w("2", "B", 50, 210), w("3", "A", 33, 150)], "A");
    expect(res).toEqual([
      { id: "1", status: "WON", payout: 185 },
      { id: "2", status: "LOST", payout: 0 },
      { id: "3", status: "WON", payout: 49 },
    ]);
  });
});

describe("computePayouts — pari mutuel", () => {
  it("partage toute la cagnotte au prorata des mises gagnantes", () => {
    const res = computePayouts(false, [w("1", "A", 100), w("2", "A", 300), w("3", "B", 600)], "A");
    expect(res).toEqual([
      { id: "1", status: "WON", payout: 250 },
      { id: "2", status: "WON", payout: 750 },
      { id: "3", status: "LOST", payout: 0 },
    ]);
  });

  it("rembourse tout le monde si personne n'a joué la bonne option", () => {
    const res = computePayouts(false, [w("1", "A", 100), w("2", "B", 40)], "C");
    expect(res.every((r) => r.status === "REFUNDED")).toBe(true);
    expect(res.map((r) => r.payout)).toEqual([100, 40]);
  });

  it("ne distribue jamais plus que la cagnotte", () => {
    const wagers = [w("1", "A", 7), w("2", "A", 11), w("3", "B", 13)];
    const paid = computePayouts(false, wagers, "A").reduce((s, r) => s + r.payout, 0);
    expect(paid).toBeLessThanOrEqual(31);
  });
});

describe("poolOdds", () => {
  it("donne la cote indicative cagnotte / mise sur l'option", () => {
    expect(poolOdds({ A: 300, B: 100, C: 0 })).toEqual({ A: 133, B: 400, C: null });
  });
});

describe("votesNeeded", () => {
  it("utilise le seuil global pour les paris publics", () => expect(votesNeeded(10)).toBe(10));
  it("réduit à la moitié du groupe, au moins 1", () => {
    expect(votesNeeded(10, 4)).toBe(2);
    expect(votesNeeded(10, 1)).toBe(1);
    expect(votesNeeded(10, 50)).toBe(10);
  });
});

describe("refilledBalance", () => {
  it("remonte au seuil sans jamais retirer", () => {
    expect(refilledBalance(120, 1000)).toBe(1000);
    expect(refilledBalance(4200, 1000)).toBe(4200);
  });
});

describe("localDateParts", () => {
  it("calcule le jour et l'heure à Paris", () => {
    // 2026-03-01 06:30 UTC = 07:30 à Paris (UTC+1)
    expect(localDateParts(new Date("2026-03-01T06:30:00Z"), "Europe/Paris")).toEqual({ day: "2026-03-01", hour: 7 });
    // 23:30 UTC = 00:30 le lendemain à Paris
    expect(localDateParts(new Date("2026-03-01T23:30:00Z"), "Europe/Paris")).toEqual({ day: "2026-03-02", hour: 0 });
  });
});
