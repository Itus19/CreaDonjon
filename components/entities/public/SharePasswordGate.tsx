"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { verifySharePasswordAction, type VerifySharePasswordState } from "@/app/partage/[token]/passwordActions";

const initialState: VerifySharePasswordState = null;

/**
 * Formulaire de mot de passe pour un lien de partage protege (V1-C4). Le
 * contenu du monde n'est jamais recupere avant validation reussie — les
 * pages publiques appelant ce composant s'arretent avant tout appel a
 * `listPublicEntities`/`getPublicEntityDetail` quand le mot de passe n'est
 * pas encore verifie (jamais "charge puis masque").
 */
export default function SharePasswordGate({ token, worldName }: { token: string; worldName: string }) {
  const router = useRouter();
  const boundAction = verifySharePasswordAction.bind(null, token);
  const [state, formAction, pending] = useActionState<VerifySharePasswordState, FormData>(boundAction, initialState);

  useEffect(() => {
    // Le cookie de verification est pose cote serveur par l'action ; ce
    // rafraichissement relance la page serveur pour qu'elle le lise et
    // charge enfin le contenu — jamais de contenu recupere avant ce point.
    if (state && "ok" in state) router.refresh();
  }, [state, router]);

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <p className="font-mech text-xs text-ink-muted">Lecture seule — lien de partage</p>
      <h1 className="entity-title">{worldName}</h1>
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
  );
}
