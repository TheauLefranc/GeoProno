import type { ReactNode } from "react";

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeletons({ n = 3, h = 220 }: { n?: number; h?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: h }} />
      ))}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="alert" role="alert">
      {error instanceof Error ? error.message : "Impossible de charger."}{" "}
      {retry && (
        <button className="link-btn" onClick={retry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Spinner() {
  return <span className="spin" aria-hidden />;
}
