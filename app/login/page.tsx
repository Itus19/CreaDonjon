"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login, createAccount, requestResetByName, type ActionState, type RequestResetByNameState } from "./actions";
import { clearCachedGet } from "@/components/shell/useCachedGet";

const initialState: ActionState = null;
const initialResetState: RequestResetByNameState = null;

/**
 * Ecran de connexion unique (V3.1-10) : deux comptes, un seul ecran — bascule
 * "Se connecter"/"Créer un compte" plutot que deux pages. La creation ici
 * mene toujours a un compte "tag" (nom + mot de passe, aucun email) ; le
 * compte ordinaire (email reel) garde son propre `/signup`, inchange,
 * jamais promu depuis cet ecran.
 */
export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "create">("login");
  const [showForgotByName, setShowForgotByName] = useState(false);
  const [loginState, loginFormAction, loginPending] = useActionState(login, initialState);
  const [createState, createFormAction, createPending] = useActionState(createAccount, initialState);
  const [resetState, resetFormAction, resetPending] = useActionState(requestResetByName, initialResetState);
  const searchParams = useSearchParams();

  // Point de passage oblige entre deux comptes (audit F-17) : le cache de
  // `useCachedGet` vit au niveau du module et survit aux navigations
  // douces, donc a `logout`/`login`. Le vider ici garantit qu'un compte ne
  // voit jamais, meme fugacement, les donnees du precedent.
  useEffect(() => {
    clearCachedGet();
  }, []);
  const linkError = searchParams.get("error") === "lien-invalide";

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-edge bg-panel p-6">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${mode === "login" ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink"}`}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${mode === "create" ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink"}`}
          >
            Créer un compte
          </button>
        </div>

        {linkError && <p className="text-sm text-danger">Ce lien n&apos;est plus valide. Refaites une demande.</p>}

        {mode === "login" ? (
          <form action={loginFormAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Nom ou email
              <input
                name="identifier"
                type="text"
                required
                autoComplete="username"
                className="rounded-md border border-edge bg-transparent px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Mot de passe
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="rounded-md border border-edge bg-transparent px-3 py-2"
              />
            </label>

            {loginState?.error && <p className="text-sm text-danger">{loginState.error}</p>}

            <button
              type="submit"
              disabled={loginPending}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {loginPending ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        ) : (
          <form action={createFormAction} className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              Ce compte ne donne accès à aucun monde tant que personne ne vous y invite ensuite.
            </p>

            <label className="flex flex-col gap-1 text-sm">
              Nom
              <input
                name="handleName"
                type="text"
                required
                maxLength={40}
                autoComplete="nickname"
                className="rounded-md border border-edge bg-transparent px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Mot de passe
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="rounded-md border border-edge bg-transparent px-3 py-2"
              />
            </label>

            {createState?.error && <p className="text-sm text-danger">{createState.error}</p>}

            <button
              type="submit"
              disabled={createPending}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {createPending ? "Création..." : "Créer le compte"}
            </button>
          </form>
        )}

        {mode === "login" && (
          <div className="flex flex-col gap-2 border-t border-edge pt-3 text-sm text-ink-muted">
            <Link href="/auth/forgot-password" className="hover:text-ink">
              Mot de passe oublié ? (compte avec email)
            </Link>

            {!showForgotByName ? (
              <button type="button" onClick={() => setShowForgotByName(true)} className="text-left hover:text-ink">
                Mot de passe oublié ? (compte sans email)
              </button>
            ) : resetState && "success" in resetState ? (
              <p className="text-ink">Demande envoyée — elle apparaît dans le panneau de votre MJ.</p>
            ) : (
              <form action={resetFormAction} className="flex flex-col gap-2">
                <input
                  name="handleName"
                  type="text"
                  required
                  placeholder="Votre nom"
                  className="rounded-md border border-edge bg-transparent px-3 py-2 text-ink"
                />
                {resetState?.error && <p className="text-danger">{resetState.error}</p>}
                <button
                  type="submit"
                  disabled={resetPending}
                  className="self-start rounded-full border border-edge px-3 py-1 text-ink-muted hover:text-ink"
                >
                  {resetPending ? "Envoi..." : "Signaler"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
