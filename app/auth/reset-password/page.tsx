"use client";

import { useActionState } from "react";
import { updatePassword, type ActionState } from "./actions";

const initialState: ActionState = null;

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <div className="flex flex-1 items-center justify-center font-sans">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-edge bg-panel p-6"
      >
        <h1 className="text-xl font-semibold text-accent">Nouveau mot de passe</h1>

        <label className="flex flex-col gap-1 text-sm">
          Mot de passe
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            className="rounded-md border border-edge bg-transparent px-3 py-2"
          />
        </label>

        {state?.error && <p className="text-sm text-danger">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Mise à jour..." : "Mettre à jour"}
        </button>
      </form>
    </div>
  );
}
