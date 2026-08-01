"use client";

import { useActionState } from "react";
import { createShareLinkAction, revokeShareLinkAction, type CreateShareLinkState } from "@/app/m/[worldSlug]/shareActions";
import type { ShareLinkRow } from "@/src/server/repos/shareLinks";

const initialState: CreateShareLinkState = null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Le jeton en clair ne s'affiche qu'une fois, juste apres la creation
 * (jamais stocke — SCHEMA.md §18) : perdu, il faut un nouveau lien, pas de
 * "revoir le lien" possible ensuite.
 */
export default function ShareLinkPanel({
  worldId,
  worldSlug,
  links,
}: {
  worldId: string;
  worldSlug: string;
  links: ShareLinkRow[];
}) {
  const [state, formAction, pending] = useActionState(createShareLinkAction, initialState);
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
              <form action={revokeShareLinkAction}>
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
