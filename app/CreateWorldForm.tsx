"use client";

import { useActionState } from "react";
import { createWorldAction, type ActionState } from "./actions";

const initialState: ActionState = null;

export default function CreateWorldForm() {
  const [state, formAction, pending] = useActionState(createWorldAction, initialState);

  return (
    <form action={formAction} className="flex gap-2">
      <input
        name="name"
        type="text"
        required
        maxLength={100}
        placeholder="Nom du monde"
        className="flex-1 rounded-md border border-edge bg-transparent px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Création..." : "Créer"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
