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

export const mainOf = (sub: string): MainCategory | undefined =>
  MAIN_CATEGORIES.find((m) => (TAXONOMY[m] as readonly string[]).includes(sub));

/** Ids accepted in a manager's scope: a whole main category or a single subcategory. */
export const SCOPE_IDS = [...MAIN_CATEGORIES, ...CATEGORIES] as [string, ...string[]];

/**
 * Who may create and run matches of a (sub)category: admins and moderators for
 * everything, sport managers for the categories in their scope.
 */
export function canManageCategory(user: { role: string; managedCategories?: string[] } | undefined, sub: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "MODERATOR") return true;
  const scope = user.managedCategories ?? [];
  const main = mainOf(sub);
  return scope.includes(sub) || (!!main && scope.includes(main));
}

/** True when the user manages at least one category without being staff. */
export const isScopedManager = (user: { role: string; managedCategories?: string[] } | undefined) =>
  !!user && user.role === "USER" && (user.managedCategories?.length ?? 0) > 0;
