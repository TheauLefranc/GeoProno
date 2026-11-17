/**
 * Two-level taxonomy (Polymarket-style). A bet stores its subcategory id.
 * Keep the ids in sync with server/src/services/categories.ts.
 */
export interface MainCategory {
  id: string;
  label: string;
  subs: { id: string; label: string }[];
}

export const TAXONOMY: MainCategory[] = [
  {
    id: "SPORT",
    label: "Sport",
    subs: [
      { id: "BABYFOOT", label: "Baby-foot" },
      { id: "FOOT", label: "Foot" },
      { id: "RUGBY", label: "Rugby" },
      { id: "BASKET", label: "Basket" },
      { id: "HAND", label: "Hand" },
      { id: "VOLLEY", label: "Volley" },
      { id: "PINGPONG", label: "Ping-pong" },
      { id: "SPORT_AUTRE", label: "Autres sports" },
    ],
  },
  {
    id: "JEUX",
    label: "Jeux",
    subs: [
      { id: "ESPORT", label: "E-sport" },
      { id: "JEUX_SOCIETE", label: "Cartes & plateau" },
      { id: "JEUX_AUTRE", label: "Autres jeux" },
    ],
  },
  {
    id: "CAMPUS",
    label: "Vie de l'école",
    subs: [
      { id: "PROFS", label: "Profs & cours" },
      { id: "EXAMS", label: "Examens" },
      { id: "SOIREES", label: "Soirées & BDE" },
      { id: "CAMPUS_AUTRE", label: "Autre (campus)" },
    ],
  },
  { id: "AUTRE", label: "Autre", subs: [{ id: "AUTRE", label: "Autre" }] },
];

export const mainOf = (sub: string) => TAXONOMY.find((m) => m.subs.some((s) => s.id === sub));

export const categoryLabel = (sub: string) => {
  for (const m of TAXONOMY) {
    const s = m.subs.find((x) => x.id === sub);
    if (s) return s.label;
  }
  return sub;
};

/** "Sport · Baby-foot" (or just "Autre" when main and sub are the same). */
export const categoryPath = (sub: string) => {
  const m = mainOf(sub);
  const label = categoryLabel(sub);
  return m && m.label !== label ? `${m.label} · ${label}` : label;
};
