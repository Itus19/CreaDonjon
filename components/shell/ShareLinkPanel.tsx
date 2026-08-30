"use client";

import { useActionState, useEffect, useState } from "react";
import { createShareLinkAction, revokeShareLinkAction, type CreateShareLinkState } from "@/app/m/[worldSlug]/shareActions";
import type { ShareLinkSummary } from "@/src/server/services/shareLinks";

const initialState: CreateShareLinkState = null;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

async function revokeWrapper(_prev: string | null, formData: FormData): Promise<string> {
  await revokeShareLinkAction(formData);
  return String(formData.get("id"));
}

/**
 * Bouton copier reutilisable : un seul etat "juste copie" partage par tous
 * les liens de ce panneau (identifie par l'URL elle-meme), pour eviter de
 * garder un `useState` par ligne.
 */
function CopyButton({ url, copiedUrl, onCopy }: { url: string; copiedUrl: string | null; onCopy: (url: string) => void }) {
  const copied = copiedUrl === url;
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(url).then(() => onCopy(url))}
      className="shrink-0 rounded-md border border-accent px-2.5 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10"
    >
      {copied ? "Copié ✓" : "Copier"}
    </button>
  );
}

/**
 * Le jeton en clair est conserve (migration 20260826180001, decision
 * explicite de l'utilisateur) : un lien de partage n'ouvre jamais qu'une
 * vue en lecture seule du contenu public d'un monde, jamais une capacite de
 * modification — pas le meme profil de risque qu'un mot de passe ou une
 * cle d'API, donc pas de raison de le rendre irrecuperable apres coup.
 * `link.token` est `null` seulement pour un lien cree avant cette decision
 * (jamais conserve a l'epoque, impossible a reconstituer). Le mot de passe
 * optionnel (V1-C4), lui, reste a usage unique : une fois saisi a la
 * creation, plus jamais lisible — seul `hasPassword` atteint ce composant.
 *
 * `onMutated` : ce panneau vit desormais dans le menu de reglages (rendu
 * global, hors contexte serveur de monde — SettingsMenu.tsx recupere
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
  links: ShareLinkSummary[];
  onMutated?: () => void;
}) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const links = initialLinks.filter((l) => !removedIds.has(l.id));
  const [password, setPassword] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(createShareLinkAction, initialState);
  const [revokedId, revokeAction] = useActionState<string | null, FormData>(revokeWrapper, null);

  useEffect(() => {
    if (state && "token" in state) onMutated?.();
  }, [state, onMutated]);

  useEffect(() => {
    if (revokedId) onMutated?.();
  }, [revokedId, onMutated]);

  function urlFor(identifier: string): string {
    return `${window.location.origin}/partage/${identifier}`;
  }

  const freshUrl = state && "token" in state ? urlFor(state.slug ?? state.token) : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-edge bg-panel-sunken p-4">
      <h2 className="block-title text-base">Partage en lecture seule</h2>
      <p className="text-xs text-ink-muted">
        Un lien anonyme n&apos;affiche que le contenu public de ce monde — jamais le contenu réservé au MJ.
      </p>

      <form action={formAction} onSubmit={() => setPassword("")} className="flex flex-col gap-2">
        <input type="hidden" name="worldId" value={worldId} />
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <div className="flex items-center gap-2">
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe (optionnel)"
            className="flex-1 rounded-md border border-edge bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Création..." : "Créer un lien"}
          </button>
        </div>
        <p className="text-[10px] text-ink-muted">
          Avec un mot de passe, le contenu ne se charge qu&apos;après validation — jamais affiché puis masqué.
        </p>
      </form>

      {state && "error" in state && <p className="text-sm text-danger">{state.error}</p>}

      {freshUrl && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Lien créé :</span>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={freshUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mech w-full min-w-0 flex-1 rounded-md border border-accent bg-transparent px-2.5 py-1.5 text-xs text-ink outline-none"
            />
            <CopyButton url={freshUrl} copiedUrl={copiedUrl} onCopy={setCopiedUrl} />
          </div>
        </div>
      )}

      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-edge/60 pt-3 text-xs">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-2">
              <span className="text-ink-muted">
                Créé le {formatDate(link.createdAt)}
                {link.hasPassword && <span className="ml-1.5 text-accent">· protégé</span>}
              </span>
              <div className="flex items-center gap-2">
                {(link.slug || link.token) && (
                  <CopyButton url={urlFor(link.slug ?? link.token!)} copiedUrl={copiedUrl} onCopy={setCopiedUrl} />
                )}
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
