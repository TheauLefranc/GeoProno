import { useState } from "react";
import { categoryPath, TAXONOMY } from "../lib/categories";
import { Spinner } from "./States";

/**
 * Fix a wrong sport at any time (before, during or after betting).
 * `allowed` limits the choices, e.g. to the sports a manager runs.
 */
export function CategoryEditor({
  value,
  allowed = () => true,
  onSave,
  pending,
  error,
}: {
  value: string;
  allowed?: (sub: string) => boolean;
  onSave: (category: string) => void;
  pending: boolean;
  error?: Error | null;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(value);
  const groups = TAXONOMY.map((m) => ({ ...m, subs: m.subs.filter((s) => allowed(s.id) || s.id === value) })).filter((m) => m.subs.length);

  if (!open)
    return (
      <div className="cat-edit">
        <span>
          Catégorie : <strong>{categoryPath(value)}</strong>
        </span>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setCategory(value);
            setOpen(true);
          }}
        >
          Corriger
        </button>
      </div>
    );

  return (
    <form
      className="cat-edit open"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(category);
        setOpen(false);
      }}
    >
      <label className="field grow">
        <span>Bonne catégorie</span>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} autoFocus>
          {groups.map((m) => (
            <optgroup key={m.id} label={m.label}>
              {m.subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="row">
        <button className="btn btn-dark btn-sm" disabled={pending || category === value}>
          {pending ? <Spinner /> : "Enregistrer"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
      {error && <div className="alert">{error.message}</div>}
    </form>
  );
}
