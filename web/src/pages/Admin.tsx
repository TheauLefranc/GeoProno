import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { api, type Role, type Settings, type User } from "../lib/api";
import { coins, CURRENCY } from "../lib/format";
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
      <Awaiting />
      {admin && <SettingsForm />}
      {admin && <Users />}
      {!admin && <p style={{ color: "var(--ink-2)" }}>Les réglages et les comptes sont réservés aux admins.</p>}
    </div>
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
    </li>
  );
}
