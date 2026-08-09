"use client";

import { useActionState, useEffect, useState } from "react";
import { createShareLinkAction, revokeShareLinkAction, type CreateShareLinkState } from "@/app/m/[worldSlug]/shareActions";
import type { ShareLinkRow } from "@/src/server/repos/shareLinks";

const initialState: CreateShareLinkState = null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

async function revokeWrapper(_prev: string | null, formData: FormData): Promise<string> {
  await revokeShareLinkAction(formData);
  return String(formData.get("id"));
}

/**
 * Le jeton en clair ne s'affiche qu'une fois, juste apres la creation
 * (jamais stocke — SCHEMA.md §18) : perdu, il faut un nouveau lien, pas de
 * "revoir le lien" possible ensuite.
 *
 * `onMutated` (V1-C4) : ce panneau vit desormais dans le menu de reglages
 * (rendu global, hors contexte serveur de monde — SettingsMenu.tsx recupere
 * `links` par un fetch client, pas par revalidation de page comme avant).
 * `links` reste derive de `initialLinks` a chaque rendu (jamais synchronise
 * par un effet, meme convention que le reste de la coquille) ; seule la
 * suppression optimiste d'un lien revoque vit dans un etat local, pose au
 * moment du clic (`onSubmit`), pas dans un effet reagissant a l'action.
 */
export default function ShareLinkPanel({
  worldId,
  worldSlug,
  links: initialLinks,
  onMutated,
}: {
  worldId: string;
  worldSlug: string;
  links: ShareLinkRow[];
  onMutated?: () => void;
}) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const links = initialLinks.filter((l) => !removedIds.has(l.id));

  const [state, formAction, pending] = useActionState(createShareLinkAction, initialState);
  const [revokedId, revokeAction] = useActionState<string | null, FormData>(revokeWrapper, null);

  useEffect(() => {
    if (state && "token" in state) onMutated?.();
  }, [state, onMutated]);

  useEffect(() => {
    if (revokedId) onMutated?.();
  }, [revokedId, onMutated]);

  const shareUrl =
    state && "token" in state && typeof window !== "undefined"
      ? `${window.location.origin}/partage/${state.token}`
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-edge bg-panel-sunken p-4">
      <h2 className="block-title text-base">Partage en lecture seule</h2>
      <p className="text-xs text-ink-muted">
        Un lien anonyme n&apos;affiche que le contenu public de ce monde — jamais le contenu réservé au MJ.
      </p>

      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="worldId" value={worldId} />
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Création..." : "Créer un lien"}
        </button>
      </form>

      {state && "error" in state && <p className="text-sm text-danger">{state.error}</p>}

      {shareUrl && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Copiez ce lien maintenant — il ne réapparaîtra plus :
          </span>
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mech w-full rounded-md border border-accent bg-transparent px-2.5 py-1.5 text-xs text-ink outline-none"
          />
        </div>
      )}

      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-edge/60 pt-3 text-xs">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-2">
              <span className="text-ink-muted">Créé le {formatDate(link.created_at)}</span>
              <form
                action={revokeAction}
                onSubmit={() => setRemovedIds((prev) => new Set(prev).add(link.id))}
              >
                <input type="hidden" name="id" value={link.id} />
                <input type="hidden" name="worldId" value={worldId} />
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <button type="submit" className="text-danger hover:underline">
                  Révoquer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
