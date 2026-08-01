"use client";

import { useActionState } from "react";
import Link from "next/link";
import { confirmEmailLink, type ActionState } from "./actions";

const initialState: ActionState = null;

const TITLES: Record<string, string> = {
  recovery: "Réinitialiser votre mot de passe",
  signup: "Confirmer votre adresse email",
  email: "Confirmer votre adresse email",
  invite: "Rejoindre",
};

export default function ConfirmForm({
  tokenHash,
  type,
  next,
}: {
  tokenHash?: string;
  type?: string;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(confirmEmailLink, initialState);

  if (!tokenHash || !type) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-2 rounded-lg border border-edge bg-panel p-6 text-center">
        <h1 className="text-xl font-semibold text-danger">Lien invalide</h1>
        <p className="text-sm text-ink-muted">
          Ce lien est incomplet.{" "}
          <Link href="/login" className="text-ink hover:underline">
            Retour à la connexion
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-edge bg-panel p-6 text-center"
    >
      <h1 className="text-xl font-semibold text-accent">{TITLES[type] ?? "Continuer"}</h1>
      <p className="text-sm text-ink-muted">
        Pour votre sécurité, la confirmation ne se fait qu&apos;à votre clic — jamais automatiquement
        à l&apos;ouverture de ce lien.
      </p>

      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {next && <input type="hidden" name="next" value={next} />}

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Confirmation..." : "Confirmer"}
      </button>
    </form>
  );
}
