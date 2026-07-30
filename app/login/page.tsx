"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login, type ActionState } from "./actions";

const initialState: ActionState = null;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error") === "lien-invalide";

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6"
      >
        <h1 className="text-xl font-semibold text-accent">Se connecter</h1>

        {linkError && (
          <p className="text-sm text-danger">
            Ce lien n&apos;est plus valide. Refaites une demande.
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Mot de passe
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>

        {state?.error && <p className="text-sm text-danger">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Connexion..." : "Se connecter"}
        </button>

        <div className="flex justify-between text-sm text-muted">
          <Link href="/signup" className="hover:text-foreground">
            Créer un compte
          </Link>
          <Link href="/auth/forgot-password" className="hover:text-foreground">
            Mot de passe oublié ?
          </Link>
        </div>
      </form>
    </div>
  );
}
