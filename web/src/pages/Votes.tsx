import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useBets } from "./Feed";
import { ProposalCard } from "../components/ProposalCard";
import { Empty, ErrorBox, Skeletons } from "../components/States";

export function VotesPage() {
  const bets = useBets("proposed");
  const toVote = bets.data?.filter((b) => !b.myVote) ?? [];
  const voted = bets.data?.filter((b) => b.myVote) ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <h1>Propositions</h1>
        <Link to="/proposer" className="btn btn-dark btn-sm">
          <Plus size={18} aria-hidden /> Proposer
        </Link>
      </div>
      <p style={{ color: "var(--ink-2)" }}>Vote pour les paris que tu veux voir ouvrir. Quand une proposition atteint son nombre de votes, elle passe sur le tableau.</p>

      {bets.isLoading ? (
        <div className="section">
          <Skeletons h={200} />
        </div>
      ) : bets.error ? (
        <div className="section">
          <ErrorBox error={bets.error} retry={() => bets.refetch()} />
        </div>
      ) : bets.data!.length === 0 ? (
        <div className="section">
          <Empty
            title="Aucune proposition en cours"
            action={
              <Link to="/proposer" className="btn btn-gold btn-sm">
                Proposer le premier pari
              </Link>
            }
          >
            Un match de baby-foot ce midi ? Un pronostic sur le prochain match ? Lance l'idée.
          </Empty>
        </div>
      ) : (
        <>
          {toVote.length > 0 && (
            <section className="section">
              <h2>À voter</h2>
              <div className="stack">
                {toVote.map((b) => (
                  <ProposalCard key={b.id} bet={b} />
                ))}
              </div>
            </section>
          )}
          {voted.length > 0 && (
            <section className="section">
              <h2>Déjà votés</h2>
              <div className="stack">
                {voted.map((b) => (
                  <ProposalCard key={b.id} bet={b} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
