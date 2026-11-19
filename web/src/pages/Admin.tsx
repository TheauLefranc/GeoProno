import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { api, type Role, type Settings, type User } from "../lib/api";
import { coins, CURRENCY } from "../lib/format";
import { scopeLabels, TAXONOMY } from "../lib/categories";
import { useAction } from "../lib/hooks";
import { isStaff, useSession } from "../lib/session";
import { ErrorBox, Skeletons, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useBets } from "./Feed";
import { BetCard } from "../components/BetCard";

export function AdminPage() {
  const { user } = useSession();
  if (!isStaff(user)) return <Navigate to="/" replace />;
  const admin = user!.role === "ADMIN";
  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <Link to="/moi" className="back">
        <ChevronLeft size={18} aria-hidden /> Moi
      </Link>
      <div className="page-head">
        <h1>Administration</h1>
      </div>
      <OddsToApprove />
      <Awaiting />
      {admin && <SettingsForm />}
      {admin && <Users />}
      {!admin && <p style={{ color: "var(--ink-2)" }}>Les réglages et les comptes sont réservés aux admins.</p>}
    </div>
  );
}

/** Public proposals with fixed odds: votes alone never open them, a moderator checks the odds first. */
function OddsToApprove() {
  const bets = useBets("proposed");
  const pending = (bets.data ?? []).filter((b) => b.oddsEnabled && !b.group);
  if (bets.isLoading || pending.length === 0) return null;
  const ready = pending.filter((b) => b.voteCount >= b.votesRequired);
  return (
    <section className="section">
      <h2>Cotes à valider</h2>
      <p style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 12 }}>
        Paris publics à cotes fixes proposés par des joueurs. Vérifie que les cotes sont raisonnables avant d'ouvrir.
        {ready.length > 0 && ` ${ready.length} ont déjà assez de votes.`}
      </p>
      <ul className="list">
        {pending.map((b) => (
          <li key={b.id}>
            <Link to={`/paris/${b.id}`} className="list-item">
              <div className="list-main">
                <div className="list-title">{b.title}</div>
                <div className="list-sub">
                  {b.options.map((o) => `${o.label} ${o.odds ? (o.odds / 100).toFixed(2) : "?"}`).join(" · ")} — par {b.creator.username}
                </div>
              </div>
              <span className={`pill ${b.voteCount >= b.votesRequired ? "won" : "pending"}`}>
                {b.voteCount}/{b.votesRequired}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Awaiting() {
  const bets = useBets("awaiting");
  return (
    <section className="section">
      <h2>Résultats à saisir</h2>
      {bets.isLoading ? (
        <Skeletons n={1} />
      ) : bets.data?.length ? (
        <div className="stack">
          {bets.data.filter((b) => !b.group).map((b) => (
            <BetCard key={b.id} bet={b} />
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--ink-2)" }}>Tout est à jour.</p>
      )}
    </section>
  );
}

function SettingsForm() {
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin-settings"], queryFn: () => api<{ settings: Settings }>("/admin/settings").then((d) => d.settings) });
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    if (q.data) setS(q.data);
  }, [q.data]);
  const save = useAction(
    () => {
      const { lastRefillDate: _ignored, ...body } = s!;
      void _ignored;
      return api("/admin/settings", { method: "PATCH", body });
    },
    [["admin-settings"], ["public-config"]],
  );
  const refill = useAction(() => api<{ count: number }>("/admin/refill", { method: "POST" }));

  if (q.isLoading || !s) return <Skeletons n={1} h={300} />;
  if (q.error) return <ErrorBox error={q.error} />;
  const num = (k: keyof Settings, label: string, hint?: string) => (
    <label className="field">
      <span>{label}</span>
      <input className="input" inputMode="numeric" value={String(s[k] ?? "")} onChange={(e) => setS({ ...s, [k]: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
      {hint && <small>{hint}</small>}
    </label>
  );

  return (
    <section className="section">
      <h2>Règles du jeu</h2>
      <form
        className="stack"
        style={{ gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: () => toast("Réglages enregistrés") });
        }}
      >
        {num("refillThreshold", "Seuil de recharge", "Chaque matin, les soldes en dessous remontent à ce montant.")}
        {num("refillHour", "Heure de la recharge (0–23, heure de Paris)")}
        {num("signupBonus", `${CURRENCY} offerts à l'inscription`)}
        {num("betOpenDays", "Ouverture des paris sur les matchs (jours avant)", "Les paris d'un match ajouté au programme ouvrent ce nombre de jours avant le coup d'envoi.")}
        {num("votesRequired", "Votes pour ouvrir un pari public", "Les paris de groupe demandent la moitié du groupe, plafonnée à ce nombre.")}
        <div className="row">
          <div className="grow">{num("minStake", "Mise min.")}</div>
          <div className="grow">{num("maxStake", "Mise max.")}</div>
        </div>
        <label className="switch">
          <span>
            Cotes fixes autorisées
            <small>Désactivé : tous les nouveaux paris fonctionnent en cagnotte partagée.</small>
          </span>
          <input type="checkbox" checked={s.oddsFeatureEnabled} onChange={(e) => setS({ ...s, oddsFeatureEnabled: e.target.checked })} />
        </label>
        {save.error && <div className="alert">{save.error.message}</div>}
        <button className="btn btn-dark" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : "Enregistrer"}
        </button>
      </form>
      <div style={{ marginTop: 24, display: "grid", gap: 8 }}>
        <p style={{ color: "var(--ink-2)", fontSize: 14 }}>Dernière recharge : {s.lastRefillDate ?? "jamais"}.</p>
        <button
          className="btn btn-ghost"
          disabled={refill.isPending}
          onClick={() => {
            if (confirm("Lancer la recharge maintenant ? Elle ne repassera pas ce matin."))
              refill.mutate(undefined, { onSuccess: (d) => toast(`${d.count} compte(s) rechargé(s)`) });
          }}
        >
          Lancer la recharge maintenant
        </button>
      </div>
    </section>
  );
}

function Users() {
  const [q, setQ] = useState("");
  const users = useQuery({
    queryKey: ["admin-users", q],
    queryFn: () => api<{ users: User[] }>(`/admin/users?q=${encodeURIComponent(q)}`).then((d) => d.users),
  });
  return (
    <section className="section">
      <h2>Comptes</h2>
      <input className="input" placeholder="Chercher un pseudo ou un email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un compte" />
      <div style={{ marginTop: 12 }}>
        {users.isLoading ? (
          <Skeletons n={3} h={60} />
        ) : users.error ? (
          <ErrorBox error={users.error} />
        ) : (
          <ul className="list">
            {users.data!.map((u) => (
              <UserRow key={u.id} u={u} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function UserRow({ u }: { u: User }) {
  const toast = useToast();
  const [adjust, setAdjust] = useState("");
  const update = useAction((body: { role?: Role; adjust?: number }) => api(`/admin/users/${u.id}`, { method: "PATCH", body }), [["admin-users"]]);
  return (
    <li className="list-item" style={{ flexWrap: "wrap" }}>
      <div className="list-main" style={{ minWidth: 160 }}>
        <div className="list-title">{u.username}</div>
        <div className="list-sub">
          {u.email} · {coins(u.balance)} {CURRENCY}
        </div>
      </div>
      <select
        className="input"
        style={{ width: "auto", height: 36 }}
        value={u.role}
        onChange={(e) => update.mutate({ role: e.target.value as Role }, { onSuccess: () => toast("Rôle mis à jour") })}
        aria-label={`Rôle de ${u.username}`}
      >
        <option value="USER">Joueur</option>
        <option value="MODERATOR">Modérateur</option>
        <option value="ADMIN">Admin</option>
      </select>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(adjust);
          if (n) update.mutate({ adjust: n }, { onSuccess: () => (setAdjust(""), toast("Solde ajusté")) });
        }}
      >
        <input className="input" style={{ width: 96, height: 36 }} inputMode="numeric" placeholder="±100" value={adjust} onChange={(e) => setAdjust(e.target.value.replace(/[^0-9-]/g, ""))} aria-label={`Ajuster le solde de ${u.username}`} />
        <button className="btn btn-ghost btn-sm" disabled={!adjust || update.isPending}>
          Ajuster
        </button>
      </form>
      {update.error && <div className="alert" style={{ width: "100%" }}>{update.error.message}</div>}
      {u.role === "USER" && <ScopeEditor u={u} />}
      <ResetLink u={u} />
    </li>
  );
}

/**
 * Sport managers: pick whole categories ("Sport") or single sports ("Rugby").
 * In scope, the user can add matches, score them live and finish them.
 */
function ScopeEditor({ u }: { u: User }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<string[]>(u.managedCategories ?? []);
  const save = useAction((managedCategories: string[]) => api(`/admin/users/${u.id}`, { method: "PATCH", body: { managedCategories } }), [
    ["admin-users"],
  ]);
  const toggle = (id: string) => setScope((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const current = u.managedCategories ?? [];
  const dirty = [...scope].sort().join() !== [...current].sort().join();

  return (
    <div style={{ width: "100%" }}>
      <button type="button" className="link-btn" style={{ fontSize: 14, color: "var(--ink-2)" }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {current.length ? `Responsable de : ${scopeLabels(current).join(", ")}` : "Responsable de sport : aucun"}
      </button>
      {open && (
        <div className="scope-editor">
          <p>Ce joueur pourra ajouter les matchs de ces sports, mettre à jour leur score en direct et les terminer (ce qui règle le pari).</p>
          {TAXONOMY.map((m) => {
            const whole = scope.includes(m.id);
            return (
              <div key={m.id} className="scope-group">
                <button type="button" className="chip chip-sub" aria-pressed={whole} onClick={() => toggle(m.id)}>
                  {m.subs.length > 1 ? `Tout ${m.label.toLowerCase()}` : m.label}
                </button>
                {m.subs.length > 1 &&
                  m.subs.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className="chip chip-sub"
                      aria-pressed={whole || scope.includes(s.id)}
                      disabled={whole}
                      onClick={() => toggle(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
              </div>
            );
          })}
          {save.error && <div className="alert">{save.error.message}</div>}
          <div className="row">
            <button
              type="button"
              className="btn btn-dark btn-sm"
              disabled={!dirty || save.isPending}
              onClick={() =>
                // A whole category already covers its sports: drop redundant entries.
                save.mutate(
                  scope.filter((id) => !TAXONOMY.some((m) => scope.includes(m.id) && m.subs.some((s) => s.id === id && s.id !== m.id))),
                  { onSuccess: () => (toast("Sports gérés mis à jour"), setOpen(false)) },
                )
              }
            >
              Enregistrer
            </button>
            {current.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={save.isPending} onClick={() => setScope([])}>
                Tout retirer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Forgot-password flow without email: the admin generates a one-time link and sends it to the user. */
function ResetLink({ u }: { u: User }) {
  const toast = useToast();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const gen = useAction(() => api<{ path: string; expiresAt: string }>(`/admin/users/${u.id}/reset-link`, { method: "POST" }));

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Lien copié");
    } catch {
      toast("Sélectionne le lien pour le copier");
    }
  };

  if (!link)
    return (
      <div style={{ width: "100%" }}>
        <button
          className="link-btn"
          style={{ fontSize: 14, color: "var(--ink-2)" }}
          disabled={gen.isPending}
          onClick={() => {
            if (!confirm(`Créer un lien de réinitialisation du mot de passe pour ${u.username} ?`)) return;
            gen.mutate(undefined, {
              onSuccess: (d) => setLink({ url: `${window.location.origin}${d.path}`, expiresAt: d.expiresAt }),
            });
          }}
        >
          {gen.isPending ? "Création…" : "Mot de passe oublié : créer un lien de réinitialisation"}
        </button>
        {gen.error && <div className="alert">{gen.error.message}</div>}
      </div>
    );

  return (
    <div className="reset-link">
      <p>
        Envoie ce lien à <strong>{u.username}</strong> (en privé). Il ne marche qu'une fois, jusqu'à {timeFmt.format(new Date(link.expiresAt))}.
      </p>
      <div className="row">
        <input className="input grow" readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Lien de réinitialisation" />
        <button className="btn btn-dark btn-sm" onClick={() => copy(link.url)}>
          Copier
        </button>
      </div>
    </div>
  );
}
