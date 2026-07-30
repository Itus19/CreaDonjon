"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type ActionState } from "./actions";

const initialState: ActionState = null;

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state && "success" in state) {
    return (
      <div className="flex flex-1 items-center justify-center font-sans">
        <div className="flex w-full max-w-sm flex-col gap-2 rounded-lg border border-border bg-surface p-6 text-center">
          <h1 className="text-xl font-semibold text-accent">Vérifiez votre email</h1>
          <p className="text-sm text-muted">
            Un email de confirmation a été envoyé. Cliquez sur le lien qu&apos;il contient pour
            activer votre compte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6"
      >
        <h1 className="text-xl font-semibold text-accent">Créer un compte</h1>

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
            autoComplete="new-password"
            minLength={8}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>

        {state?.error && <p className="text-sm text-danger">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Création..." : "Créer un compte"}
        </button>

        <Link href="/login" className="text-sm text-muted hover:text-foreground">
          Déjà un compte ? Se connecter
        </Link>
      </form>
    </div>
  );
}
