import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { api, type GroupSummary } from "../lib/api";
import { useAction } from "../lib/hooks";
import { Empty, ErrorBox, Skeletons, Spinner } from "../components/States";

export function GroupsPage() {
  const navigate = useNavigate();
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<{ groups: GroupSummary[] }>("/groups").then((d) => d.groups) });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const create = useAction(() => api<{ group: { id: string } }>("/groups", { body: { name } }), [["groups"]]);
  const join = useAction(() => api<{ group: { id: string } }>("/groups/join", { body: { code } }), [["groups"]]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Groupes</h1>
      </div>
      <p style={{ color: "var(--ink-2)" }}>Des paris privés entre potes, avec leur propre classement.</p>

      <section className="section">
        {groups.isLoading ? (
          <Skeletons n={2} h={64} />
        ) : groups.error ? (
          <ErrorBox error={groups.error} retry={() => groups.refetch()} />
        ) : groups.data!.length === 0 ? (
          <Empty title="Aucun groupe pour l'instant">Crée un groupe pour ta promo ou ton équipe, ou rejoins-en un avec le code qu'on t'a donné.</Empty>
        ) : (
          <ul className="list">
            {groups.data!.map((g) => (
              <li key={g.id}>
                <Link to={`/groupes/${g.id}`} className="list-item">
                  <div className="list-main">
                    <div className="list-title">{g.name}</div>
                    <div className="list-sub">
                      {g.memberCount} membre{g.memberCount > 1 ? "s" : ""} · {g.activeBets} pari{g.activeBets > 1 ? "s" : ""} en cours
                      {g.isOwner ? " · créé par toi" : ""}
                    </div>
                  </div>
                  <ChevronRight size={18} aria-hidden color="var(--ink-3)" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>Rejoindre avec un code</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            join.mutate(undefined, { onSuccess: (d) => navigate(`/groupes/${d.group.id}`) });
          }}
        >
          <input
            className="input grow"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            placeholder="K7QW2M"
            aria-label="Code d'invitation"
            style={{ fontFamily: "var(--font-led)", fontWeight: 900, fontSize: 22, letterSpacing: "0.12em" }}
            required
          />
          <button className="btn btn-dark" disabled={join.isPending || code.length < 4}>
            {join.isPending ? <Spinner /> : "Rejoindre"}
          </button>
        </form>
        {join.error && (
          <div className="alert" style={{ marginTop: 8 }}>
            {join.error.message}
          </div>
        )}
      </section>

      <section className="section" style={{ paddingBottom: 24 }}>
        <h2>Créer un groupe</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(undefined, { onSuccess: (d) => navigate(`/groupes/${d.group.id}`) });
          }}
        >
          <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Les pétrologues du fond" maxLength={40} required aria-label="Nom du groupe" />
          <button className="btn btn-gold" disabled={create.isPending || name.trim().length < 2}>
            {create.isPending ? <Spinner /> : "Créer"}
          </button>
        </form>
        {create.error && (
          <div className="alert" style={{ marginTop: 8 }}>
            {create.error.message}
          </div>
        )}
      </section>
    </div>
  );
}
