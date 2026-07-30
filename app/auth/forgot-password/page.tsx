"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ActionState } from "./actions";

const initialState: ActionState = null;

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  if (state && "success" in state) {
    return (
      <div className="flex flex-1 items-center justify-center font-sans">
        <div className="flex w-full max-w-sm flex-col gap-2 rounded-lg border border-border bg-surface p-6 text-center">
          <h1 className="text-xl font-semibold text-accent">Email envoyé</h1>
          <p className="text-sm text-muted">
            Si un compte existe avec cette adresse, un email pour réinitialiser le mot de passe
            vient d&apos;être envoyé.
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
        <h1 className="text-xl font-semibold text-accent">Mot de passe oublié</h1>
        <p className="text-sm text-muted">
          Saisissez votre email, nous vous enverrons un lien de réinitialisation.
        </p>

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

        {state?.error && <p className="text-sm text-danger">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Envoi..." : "Envoyer le lien"}
        </button>

        <Link href="/login" className="text-sm text-muted hover:text-foreground">
          Retour à la connexion
        </Link>
      </form>
    </div>
  );
}
