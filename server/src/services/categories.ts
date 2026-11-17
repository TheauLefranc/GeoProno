/**
 * Two-level taxonomy (Polymarket-style): main categories, each with subcategories.
 * A bet stores its SUBcategory id; the main category is derived from it.
 * Keep in sync with web/src/lib/categories.ts.
 */
export const TAXONOMY = {
  SPORT: ["BABYFOOT", "FOOT", "RUGBY", "BASKET", "HAND", "VOLLEY", "PINGPONG", "SPORT_AUTRE"],
  JEUX: ["ESPORT", "JEUX_SOCIETE", "JEUX_AUTRE"],
  CAMPUS: ["PROFS", "EXAMS", "SOIREES", "CAMPUS_AUTRE"],
  AUTRE: ["AUTRE"],
} as const;

export type MainCategory = keyof typeof TAXONOMY;
export const MAIN_CATEGORIES = Object.keys(TAXONOMY) as [MainCategory, ...MainCategory[]];
export const CATEGORIES = Object.values(TAXONOMY).flat() as unknown as [string, ...string[]];
export type Category = (typeof TAXONOMY)[MainCategory][number];

export const subcategoriesOf = (main: MainCategory): string[] => [...TAXONOMY[main]];
