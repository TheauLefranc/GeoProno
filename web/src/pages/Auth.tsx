import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, type User } from "../lib/api";
import { usePublicConfig } from "../lib/hooks";
import { useSetUser } from "../lib/session";
import { Led } from "../components/Led";
import { Spinner } from "../components/States";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const setUser = useSetUser();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const cfg = usePublicConfig();
  const domains = cfg.data?.allowedEmailDomains ?? [];

  const submit = useMutation({
    mutationFn: () =>
      api<{ user: User }>(mode === "login" ? "/auth/login" : "/auth/register", {
        body: mode === "login" ? { email, password } : { email, username, password },
      }),
    onSuccess: (d) => {
      setUser(d.user);
      navigate("/", { replace: true });
    },
  });

  const register = mode === "register";
  return (
    <div className="auth">
      <div className="auth-board">
        <Led value="GEOPRONO" />
        <p>
          {register
            ? "Crée ton compte, reçois tes premières pièces et parie sur les matchs de l'école."
            : "Les paris de l'école, en pièces virtuelles. Rechargées chaque matin."}
        </p>
      </div>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
      >
        <h1 style={{ font: "700 28px/1.1 var(--font-c)" }}>{register ? "Créer un compte" : "Connexion"}</h1>
        <label className="field">
          <span>Email{register && domains.length ? " de l'école" : ""}</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={domains.length ? `prenom.nom@${domains[0]}` : "prenom.nom@ecole.fr"}
          />
        </label>
        {register && (
          <label className="field">
            <span>Pseudo</span>
            <input
              className="input"
              autoComplete="username"
              required
              minLength={3}
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <small>C'est ce nom qui apparaît au classement.</small>
          </label>
        )}
        <label className="field">
          <span>Mot de passe</span>
          <input
            className="input"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {register && <small>8 caractères minimum.</small>}
        </label>
        {submit.error && (
          <div className="alert" role="alert">
            {submit.error.message}
          </div>
        )}
        <button className="btn btn-gold btn-block" disabled={submit.isPending}>
          {submit.isPending ? <Spinner /> : register ? "Créer mon compte" : "Se connecter"}
        </button>
        <p style={{ textAlign: "center", color: "var(--ink-2)" }}>
          {register ? (
            <>
              Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
            </>
          ) : (
            <>
              Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
