import { describe, expect, it } from "vitest";
import {
  BYE,
  computeBracketPayouts,
  entrants,
  initialOutcomes,
  isByeMatch,
  maxPoints,
  parentOf,
  roundOf,
  scorePicks,
  validateParticipants,
  validatePicks,
} from "../src/services/bracketLogic";

const eight = ["A", "B", "C", "D", "E", "F", "G", "H"];

describe("structure du tableau", () => {
  it("numérote les matchs tour par tour", () => {
    expect([0, 3, 4, 5, 6].map((i) => roundOf(8, i))).toEqual([0, 0, 1, 1, 2]);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => parentOf(8, i))).toEqual([4, 4, 5, 5, 6, 6, null]);
  });

  it("donne les participants du premier tour puis ceux issus des vainqueurs", () => {
    expect(entrants(8, eight, [], 1)).toEqual([2, 3]);
    expect(entrants(8, eight, [0, 3, null, null], 4)).toEqual([0, 3]);
    expect(entrants(8, eight, [0, 3, null, null], 5)).toEqual([null, null]);
  });
});

describe("exempts", () => {
  const withByes = ["A", "", "C", "D"];

  it("qualifie d'office l'adversaire d'un exempt", () => {
    expect(initialOutcomes(4, withByes)).toEqual([0, null, null]);
    expect(isByeMatch(4, withByes, 0)).toBe(true);
    expect(isByeMatch(4, withByes, 1)).toBe(false);
  });

  it("ne compte pas les matchs contre un exempt dans le maximum", () => {
    expect(maxPoints(4, ["A", "B", "C", "D"])).toBe(4);
    expect(maxPoints(4, withByes)).toBe(3);
  });

  it("refuse un match sans aucun participant et les doublons", () => {
    expect(validateParticipants(4, ["", "", "C", "D"])).toMatch(/aucun participant/);
    expect(validateParticipants(4, ["A", "a", "C", "D"])).toMatch(/même nom/);
    expect(validateParticipants(4, ["A", "", "C", "D"])).toBeNull();
    expect(validateParticipants(6, ["A", "B", "C", "D", "E", "F"])).toMatch(/Taille/);
  });
});

describe("validatePicks", () => {
  it("accepte un pronostic cohérent", () => {
    expect(validatePicks(8, eight, [0, 2, 5, 7, 0, 7, 7])).toBeNull();
  });

  it("refuse un vainqueur qui ne vient pas du match précédent", () => {
    expect(validatePicks(8, eight, [0, 2, 5, 7, 1, 7, 7])).toMatch(/incohérent/);
    expect(validatePicks(8, eight, [0, 2, 5, 7, 0, 7, 3])).toMatch(/incohérent/);
  });

  it("refuse un pronostic incomplet", () => {
    expect(validatePicks(8, eight, [0, 2, 5, 7, 0, 7])).toMatch(/incomplet/);
    expect(validatePicks(8, eight, [0, 2, 5, 7, 0, 7, null])).toMatch(/incomplet/);
  });

  it("impose l'adversaire d'un exempt", () => {
    expect(validatePicks(4, ["A", "", "C", "D"], [0, 2, 0])).toBeNull();
    expect(validatePicks(4, ["A", "", "C", "D"], [BYE, 2, 2])).toMatch(/exempt/);
  });
});

describe("scorePicks", () => {
  it("double les points à chaque tour et ignore les matchs pas encore joués", () => {
    const picks = [0, 2, 5, 7, 0, 7, 7];
    expect(scorePicks(8, eight, picks, [0, 3, 5, 7, null, null, null])).toBe(3);
    expect(scorePicks(8, eight, picks, [0, 3, 5, 7, 0, 7, 0])).toBe(3 + 4);
    expect(scorePicks(8, eight, picks, [0, 2, 5, 7, 0, 7, 7])).toBe(4 + 4 + 4);
  });

  it("ne donne pas de point pour un exempt", () => {
    expect(scorePicks(4, ["A", "", "C", "D"], [0, 2, 0], [0, 2, 0])).toBe(1 + 2);
  });
});

describe("computeBracketPayouts", () => {
  it("partage la cagnotte au prorata mise × points", () => {
    const res = computeBracketPayouts([
      { id: "1", amount: 100, points: 6 },
      { id: "2", amount: 200, points: 3 },
      { id: "3", amount: 300, points: 0 },
    ]);
    expect(res).toEqual([
      { id: "1", status: "WON", payout: 300 },
      { id: "2", status: "WON", payout: 300 },
      { id: "3", status: "LOST", payout: 0 },
    ]);
  });

  it("ne crée jamais de pièces (arrondi par défaut)", () => {
    const res = computeBracketPayouts([
      { id: "1", amount: 10, points: 1 },
      { id: "2", amount: 10, points: 1 },
      { id: "3", amount: 11, points: 1 },
    ]);
    expect(res.reduce((s, r) => s + r.payout, 0)).toBeLessThanOrEqual(31);
  });

  it("rembourse tout le monde si personne ne marque", () => {
    const res = computeBracketPayouts([
      { id: "1", amount: 40, points: 0 },
      { id: "2", amount: 60, points: 0 },
    ]);
    expect(res).toEqual([
      { id: "1", status: "REFUNDED", payout: 40 },
      { id: "2", status: "REFUNDED", payout: 60 },
    ]);
  });
});
