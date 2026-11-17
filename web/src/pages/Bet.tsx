import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { api, type Bet } from "../lib/api";
import { categoryPath, coins, odds, when } from "../lib/format";
import { useAction, usePublicConfig } from "../lib/hooks";
import { useSession } from "../lib/session";
import { BetCard } from "../components/BetCard";
import { ProposalCard } from "../components/ProposalCard";
import { ErrorBox, Skeletons, Spinner } from "../components/States";
import { useToast } from "../components/Toast";

export function BetPage() {
  const { id = "" } = useParams();
  const bet = useQuery({
    queryKey: ["bet", id],
    queryFn: () => api<{ bet: Bet }>(`/bets/${id}`).then((d) => d.bet),
    refetchInterval: 15_000,
  });

  return (
    <div className="page">
      <Link to="/" className="back">
        <ChevronLeft size={18} aria-hidden /> Paris
      </Link>
      <div style={{ height: 16 }} />
      {bet.isLoading ? (
        <Skeletons n={1} h={320} />
      ) : bet.error ? (
        <ErrorBox error={bet.error} retry={() => bet.refetch()} />
      ) : (
        <BetDetail bet={bet.data!} />
      )}
    </div>
  );
}

function BetDetail({ bet }: { bet: Bet }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const withdraw = useAction(() => api(`/bets/${bet.id}/cancel`, { method: "POST" }));
  const isProposal = bet.status === "PROPOSED";

  return (
    <div className="stack" style={{ gap: 20, paddingBottom: 24 }}>
      {isProposal ? <ProposalCard bet={bet} /> : <BetCard bet={bet} linkTitle={false} />}

      <section>
        <ul className="list">
          {bet.description && (
            <li className="list-item" style={{ whiteSpace: "pre-wrap" }}>
              {bet.description}
            </li>
          )}
          <Info k="Catégorie" v={categoryPath(bet.category)} />
          <Info k="Mode" v={bet.oddsEnabled ? "Cotes fixes : gain = mise × cote au moment du pari" : "Cagnotte : les gagnants se partagent toutes les mises"} />
          <Info k="Fin des mises" v={when(bet.closesAt)} />
          <Info k="Proposé par" v={bet.creator.username} />
          {bet.group && <Info k="Groupe" v={<Link to={`/groupes/${bet.group.id}`}>{bet.group.name}</Link>} />}
          <Info k="Votes" v={`${bet.voteCount}/${bet.votesRequired}`} />
        </ul>
      </section>

      {bet.myWagers.length > 0 && (
        <section>
          <h2 style={{ font: "700 20px/1.2 var(--font-c)", marginBottom: 12 }}>Tes mises</h2>
          <ul className="list">
            {bet.myWagers.map((w) => {
              const o = bet.options.find((x) => x.id === w.optionId);
              return (
                <li key={w.id} className="list-item">
                  <div className="list-main">
                    <div className="list-title">{o?.label}</div>
                    <div className="list-sub">{w.oddsX100 ? `Cote ${odds(w.oddsX100)}` : "Cagnotte"}</div>
                  </div>
                  <span className="amount">{coins(w.amount)}</span>
                  <WagerPill status={w.status} payout={w.payout} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {bet.canModerate && <Moderation bet={bet} />}

      {isProposal && bet.creator.id === user?.id && !bet.canModerate && (
        <button
          className="btn btn-danger"
          disabled={withdraw.isPending}
          onClick={() =>
            withdraw.mutate(undefined, {
              onSuccess: () => {
                toast("Proposition retirée");
                navigate("/votes");
              },
            })
          }
        >
          Retirer ma proposition
        </button>
      )}
    </div>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <li className="list-item" style={{ minHeight: 48, padding: "10px 16px" }}>
      <span className="list-sub" style={{ width: 110, flex: "none" }}>
        {k}
      </span>
      <span style={{ fontWeight: 600 }}>{v}</span>
    </li>
  );
}

export function WagerPill({ status, payout }: { status: string; payout: number | null }) {
  if (status === "WON") return <span className="pill won">+{coins(payout ?? 0)}</span>;
  if (status === "LOST") return <span className="pill lost">Perdu</span>;
  if (status === "REFUNDED") return <span className="pill">Remboursé</span>;
  return <span className="pill pending">En cours</span>;
}

function Moderation({ bet }: { bet: Bet }) {
  const toast = useToast();
  const cfg = usePublicConfig();
  const [winner, setWinner] = useState<string>("");
  const [oddsOn, setOddsOn] = useState(bet.oddsEnabled);
  const [oddsVals, setOddsVals] = useState<Record<string, string>>({});
  const hasWagers = bet.pool > 0;
  const active = bet.status === "PROPOSED" || bet.status === "OPEN";

  useEffect(() => {
    setOddsOn(bet.oddsEnabled);
    setOddsVals(Object.fromEntries(bet.options.map((o) => [o.id, bet.oddsEnabled && o.odds ? (o.odds / 100).toFixed(2) : ""])));
  }, [bet.id, bet.oddsEnabled, bet.options]);

  const approve = useAction(() => api(`/bets/${bet.id}/approve`, { method: "POST" }), [["bet", bet.id]]);
  const reject = useAction(() => api(`/bets/${bet.id}/reject`, { method: "POST" }), [["bet", bet.id]]);
  const cancel = useAction(() => api(`/bets/${bet.id}/cancel`, { method: "POST" }), [["bet", bet.id]]);
  const settle = useAction(() => api(`/bets/${bet.id}/settle`, { body: { optionId: winner } }), [["bet", bet.id]]);
  const saveOdds = useAction(
    () =>
      api(`/bets/${bet.id}/odds`, {
        method: "PATCH",
        body: {
          oddsEnabled: oddsOn,
          odds: Object.fromEntries(
            Object.entries(oddsVals)
              .filter(([, v]) => v)
              .map(([k, v]) => [k, Number(v.replace(",", "."))]),
          ),
        },
      }),
    [["bet", bet.id]],
  );
  const error = approve.error || reject.error || cancel.error || settle.error || saveOdds.error;

  if (!active) return null;
  return (
    <section className="panel board" aria-label="Modération">
      <h2 style={{ font: "700 20px/1.2 var(--font-c)" }}>{bet.group ? "Gestion du pari (créateur du groupe)" : "Modération"}</h2>
      {error && <div className="alert">{error.message}</div>}

      {bet.status === "PROPOSED" && (
        <div className="row">
          <button className="btn btn-gold grow" disabled={approve.isPending} onClick={() => approve.mutate(undefined, { onSuccess: () => toast("Pari ouvert") })}>
            Ouvrir sans attendre les votes
          </button>
          <button className="btn btn-ghost" disabled={reject.isPending} onClick={() => reject.mutate(undefined, { onSuccess: () => toast("Proposition refusée") })}>
            Refuser
          </button>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <span className="label-c">Cotes</span>
        {cfg.data?.oddsFeatureEnabled !== false && (
          <label className="row" style={{ justifyContent: "space-between", color: "var(--panel-text)" }}>
            <span>{hasWagers ? "Mode verrouillé : des mises sont placées" : "Activer les cotes fixes"}</span>
            <span className="switch" style={{ border: 0, background: "transparent", padding: 0 }}>
              <input type="checkbox" checked={oddsOn} disabled={hasWagers} onChange={(e) => setOddsOn(e.target.checked)} />
            </span>
          </label>
        )}
        {oddsOn && (
          <div className="stack" style={{ gap: 6 }}>
            {bet.options.map((o) => (
              <label key={o.id} className="stake-input" style={{ padding: "0 4px 0 12px" }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{o.label}</span>
                <input
                  style={{ maxWidth: 110, fontSize: 22, height: 44, textAlign: "right" }}
                  inputMode="decimal"
                  value={oddsVals[o.id] ?? ""}
                  placeholder="1.80"
                  onChange={(e) => setOddsVals((v) => ({ ...v, [o.id]: e.target.value.replace(/[^0-9.,]/g, "") }))}
                  aria-label={`Cote ${o.label}`}
                />
              </label>
            ))}
            <small style={{ color: "var(--panel-muted)" }}>Les mises déjà placées gardent la cote du moment où elles ont été prises.</small>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} disabled={saveOdds.isPending} onClick={() => saveOdds.mutate(undefined, { onSuccess: () => toast("Cotes enregistrées") })}>
          Enregistrer les cotes
        </button>
      </div>

      {bet.status === "OPEN" && (
        <div className="stack" style={{ gap: 8, borderTop: "1px dashed var(--panel-line)", paddingTop: 16 }}>
          <span className="label-c">Résultat</span>
          <div className="sides" style={{ gridTemplateColumns: `repeat(${Math.min(bet.options.length, 3)}, 1fr)` }}>
            {bet.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                className="side"
                style={{ minHeight: 56, ["--c" as string]: `var(--series-${i % 6})` }}
                aria-pressed={winner === o.id}
                onClick={() => setWinner(o.id)}
              >
                <span className="side-name">{o.label}</span>
              </button>
            ))}
          </div>
          <div className="divider-gap" />
          <button
            className="btn btn-gold btn-block"
            disabled={!winner || settle.isPending}
            onClick={() => settle.mutate(undefined, { onSuccess: () => toast("Pari réglé, gains versés") })}
          >
            {settle.isPending ? <Spinner /> : winner ? `Valider : ${bet.options.find((o) => o.id === winner)?.label} gagne` : "Choisis l'issue gagnante"}
          </button>
          <small style={{ color: "var(--panel-muted)", textAlign: "center" }}>Irréversible : les gains sont versés immédiatement.</small>
        </div>
      )}

      <div style={{ borderTop: "1px dashed var(--panel-line)", paddingTop: 16, marginTop: 8 }}>
        <button
          className="btn btn-danger btn-block"
          disabled={cancel.isPending}
          onClick={() => {
            if (confirm("Annuler ce pari et rembourser toutes les mises ?")) cancel.mutate(undefined, { onSuccess: () => toast("Pari annulé, mises remboursées") });
          }}
        >
          Annuler le pari et rembourser
        </button>
      </div>
    </section>
  );
}
