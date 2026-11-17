import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Plus, X } from "lucide-react";
import { api, type Bet, type GroupSummary } from "../lib/api";
import { CATEGORIES } from "../lib/format";
import { useAction, usePublicConfig } from "../lib/hooks";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";

function defaultClose() {
  const d = new Date(Date.now() + 2 * 3600_000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProposePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<{ groups: GroupSummary[] }>("/groups").then((d) => d.groups) });
  const settings = usePublicConfig();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("BABYFOOT");
  const [closesAt, setClosesAt] = useState(defaultClose);
  const [groupId, setGroupId] = useState(params.get("groupe") ?? "");
  const [oddsEnabled, setOddsEnabled] = useState(false);
  const [options, setOptions] = useState([
    { label: "", odds: "" },
    { label: "", odds: "" },
  ]);
  const oddsAllowed = settings.data?.oddsFeatureEnabled ?? true;

  const create = useAction(() =>
    api<{ bet: Bet }>("/bets", {
      body: {
        title,
        description: description || undefined,
        category,
        closesAt: new Date(closesAt).toISOString(),
        groupId: groupId || undefined,
        oddsEnabled,
        options: options.map((o) => ({
          label: o.label,
          odds: oddsEnabled && o.odds ? Number(o.odds.replace(",", ".")) : undefined,
        })),
      },
    }),
  );

  const setOpt = (i: number, patch: Partial<{ label: string; odds: string }>) =>
    setOptions((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <div className="page">
      <Link to="/votes" className="back">
        <ChevronLeft size={18} aria-hidden /> Propositions
      </Link>
      <div className="page-head">
        <h1>Proposer un pari</h1>
      </div>
      <form
        className="stack"
        style={{ gap: 20, paddingBottom: 24 }}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(undefined, {
            onSuccess: ({ bet }) => {
              toast(bet.status === "OPEN" ? "Pari ouvert, à vous de jouer" : "Proposition envoyée au vote");
              navigate(bet.status === "OPEN" ? `/paris/${bet.id}` : "/votes");
            },
          });
        }}
      >
        <label className="field">
          <span>La question</span>
          <input
            className="input"
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Qui gagne la finale de baby-foot ?"
          />
        </label>

        <div className="field">
          <span>Sport</span>
          <div className="rail" style={{ paddingTop: 0, paddingBottom: 0 }} role="group" aria-label="Sport">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.id} className="chip" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Les issues possibles</legend>
          <div className="stack" style={{ gap: 8 }}>
            {options.map((o, i) => (
              <div className="row" key={i}>
                <input
                  className="input grow"
                  required
                  maxLength={40}
                  value={o.label}
                  onChange={(e) => setOpt(i, { label: e.target.value })}
                  placeholder={i === 0 ? "Équipe A" : i === 1 ? "Équipe B" : `Option ${i + 1}`}
                  aria-label={`Option ${i + 1}`}
                />
                {oddsEnabled && (
                  <input
                    className="input"
                    style={{ width: 88 }}
                    inputMode="decimal"
                    required
                    value={o.odds}
                    onChange={(e) => setOpt(i, { odds: e.target.value.replace(/[^0-9.,]/g, "") })}
                    placeholder="1.80"
                    aria-label={`Cote de l'option ${i + 1}`}
                  />
                )}
                {options.length > 2 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}
                    aria-label={`Retirer l'option ${i + 1}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ justifySelf: "start", marginTop: 8 }}
              onClick={() => setOptions((os) => [...os, { label: "", odds: "" }])}
            >
              <Plus size={16} aria-hidden /> Ajouter une issue (match nul…)
            </button>
          )}
        </fieldset>

        <label className="switch">
          <span>
            Cotes fixes
            <small>
              {oddsAllowed
                ? oddsEnabled
                  ? "Le gain = mise × cote. Les modérateurs peuvent ajuster les cotes."
                  : "Désactivé : la cagnotte est partagée entre les gagnants."
                : "Les cotes sont désactivées par les admins : cagnotte partagée."}
            </small>
          </span>
          <input type="checkbox" checked={oddsEnabled} disabled={!oddsAllowed} onChange={(e) => setOddsEnabled(e.target.checked)} />
        </label>

        <label className="field">
          <span>Fin des mises</span>
          <input className="input" type="datetime-local" required value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          <small>Au coup d'envoi en général. La proposition expire si elle n'a pas ses votes d'ici là.</small>
        </label>

        {groups.data && groups.data.length > 0 && (
          <label className="field">
            <span>Visible par</span>
            <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Toute l'école</option>
              {groups.data.map((g) => (
                <option key={g.id} value={g.id}>
                  Groupe {g.name} ({g.memberCount})
                </option>
              ))}
            </select>
            <small>Un pari de groupe a besoin des votes de la moitié du groupe, et c'est le créateur du groupe qui saisit le résultat.</small>
          </label>
        )}

        <label className="field">
          <span>Détails (facultatif)</span>
          <textarea
            className="input"
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Règles, lieu, comment le résultat sera vérifié…"
          />
        </label>

        {create.error && (
          <div className="alert" role="alert">
            {create.error.message}
          </div>
        )}
        <button className="btn btn-gold btn-block" disabled={create.isPending}>
          {create.isPending ? <Spinner /> : "Envoyer au vote"}
        </button>
      </form>
    </div>
  );
}
