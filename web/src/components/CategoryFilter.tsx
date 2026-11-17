import { TAXONOMY } from "../lib/categories";

export interface CategoryValue {
  main?: string;
  sub?: string;
}

/**
 * Polymarket-style two-level filter: a text tab bar of main categories,
 * then the chosen category's subcategories as chips.
 */
export function CategoryFilter({ value, onChange }: { value: CategoryValue; onChange: (v: CategoryValue) => void }) {
  const main = TAXONOMY.find((m) => m.id === value.main);
  return (
    <div className="catfilter">
      <div className="maintabs" role="tablist" aria-label="Catégorie">
        <button role="tab" aria-selected={!value.main} className="maintab" onClick={() => onChange({})}>
          Tout
        </button>
        {TAXONOMY.map((m) => (
          <button key={m.id} role="tab" aria-selected={value.main === m.id} className="maintab" onClick={() => onChange({ main: m.id })}>
            {m.label}
          </button>
        ))}
      </div>
      {main && main.subs.length > 1 && (
        <div className="rail" role="group" aria-label={`Sous-catégories ${main.label}`}>
          <button className="chip" aria-pressed={!value.sub} onClick={() => onChange({ main: main.id })}>
            Tout {main.label.toLowerCase()}
          </button>
          {main.subs.map((s) => (
            <button key={s.id} className="chip" aria-pressed={value.sub === s.id} onClick={() => onChange({ main: main.id, sub: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
