import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, type User } from "../lib/api";
import { useSetUser } from "../lib/session";
import { Led } from "../components/Led";
import { Skeletons, Spinner } from "../components/States";

/** Landing page of an admin-generated reset link: choose a new password, then you're signed in. */
export function ResetPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const setUser = useSetUser();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const check = useQuery({
    queryKey: ["reset", token],
    queryFn: () => api<{ username: string; expiresAt: string }>(`/auth/reset/${token}`),
    retry: false,
  });
  const submit = useMutation({
    mutationFn: () => api<{ user: User }>("/auth/reset", { body: { token, password } }),
    onSuccess: (d) => {
      setUser(d.user);
      navigate("/", { replace: true });
    },
  });
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <div className="auth">
      <div className="auth-board">
        <Led value="GEOPRONO" />
        <p>Choisis un nouveau mot de passe. Tes autres appareils seront déconnectés.</p>
      </div>
      <div className="auth-form">
        <h1 style={{ font: "700 28px/1.1 var(--font-c)" }}>Nouveau mot de passe</h1>
        {check.isLoading ? (
          <Skeletons n={1} h={160} />
        ) : check.error ? (
          <>
            <div className="alert" role="alert">
              {check.error.message}
            </div>
            <Link to="/connexion" className="btn btn-ghost btn-block">
              Retour à la connexion
            </Link>
          </>
        ) : (
          <form
            className="stack"
            style={{ gap: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!mismatch) submit.mutate();
            }}
          >
            <p style={{ color: "var(--ink-2)" }}>
              Compte : <strong style={{ color: "var(--ink)" }}>{check.data!.username}</strong>
            </p>
            <label className="field">
              <span>Nouveau mot de passe</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <small>8 caractères minimum.</small>
            </label>
            <label className="field">
              <span>Confirme-le</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch}
              />
              {mismatch && <small style={{ color: "var(--red)" }}>Les deux mots de passe ne sont pas identiques.</small>}
            </label>
            {submit.error && (
              <div className="alert" role="alert">
                {submit.error.message}
              </div>
            )}
            <button className="btn btn-gold btn-block" disabled={submit.isPending || mismatch}>
              {submit.isPending ? <Spinner /> : "Enregistrer et me connecter"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
