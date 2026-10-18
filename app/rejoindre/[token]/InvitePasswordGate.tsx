"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { verifyInvitePasswordAction, type VerifyInvitePasswordState } from "./passwordActions";
import { PANNEAU_VERRE, TITRE_PANNEAU } from "@/components/brand/CadreTitre";

const initialState: VerifyInvitePasswordState = null;

/** Même DA que `SharePasswordGate.tsx` (partage public) — jamais l'écran « MJ / PJ » avant validation. */
export default function InvitePasswordGate({ token }: { token: string }) {
  const router = useRouter();
  const boundAction = verifyInvitePasswordAction.bind(null, token);
  const [state, formAction, pending] = useActionState<VerifyInvitePasswordState, FormData>(boundAction, initialState);

  useEffect(() => {
    if (state && "ok" in state) router.refresh();
  }, [state, router]);

  return (
    <div className={PANNEAU_VERRE}>
      <div className="contents">
        <h2 className={TITRE_PANNEAU}>Bienvenue</h2>
        <p className="text-sm text-ink-muted">Ce lien est protégé par un mot de passe.</p>
        <form action={formAction} className="flex flex-col gap-2">
          <input
            type="password"
            name="password"
            placeholder="Mot de passe"
            autoFocus
            className="rounded-md border border-edge bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Vérification…" : "Valider"}
          </button>
          {state && "error" in state && <p className="text-sm text-danger">{state.error}</p>}
        </form>
      </div>
    </div>
  );
}
