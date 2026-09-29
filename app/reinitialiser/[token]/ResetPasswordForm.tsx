"use client";

import { useActionState } from "react";
import { submitNewPassword, type ActionState } from "./actions";

const initialState: ActionState = null;

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(submitNewPassword, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-edge bg-panel p-6">
      <input type="hidden" name="token" value={token} />
      <h1 className="text-xl font-semibold text-accent">Choisis un nouveau mot de passe</h1>

      <label className="flex flex-col gap-1 text-sm">
        Mot de passe
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoFocus
          autoComplete="new-password"
          className="rounded-md border border-edge bg-transparent px-3 py-2"
        />
      </label>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Enregistrer et se connecter"}
      </button>
    </form>
  );
}
