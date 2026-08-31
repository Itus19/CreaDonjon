"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateWikiWelcomeMessageAction, type UpdateWikiWelcomeMessageState } from "@/app/m/[worldSlug]/wikiSettingsActions";
import ShareLinkPanel from "./ShareLinkPanel";
import type { ShareLinkSummary } from "@/src/server/services/shareLinks";

/**
 * Message d'accueil du wiki public (V2-G2, extension) : remplace le gros
 * titre de la page d'accueil du lien de partage — voir `BookSkin` et
 * `app/partage/[token]/page.tsx`. Vide = pas de personnalisation, la page
 * publique retombe alors sur un message calcule (nom de la campagne).
 * Extrait tel quel de l'ancien menu de reglages (`SettingsMenu.tsx`).
 */
function WikiWelcomeMessageForm({ worldId, initialMessage }: { worldId: string; initialMessage: string }) {
  const [state, formAction, pending] = useActionState<UpdateWikiWelcomeMessageState, FormData>(
    updateWikiWelcomeMessageAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="worldId" value={worldId} />
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Message d&apos;accueil du wiki
        <textarea
          name="message"
          defaultValue={initialMessage}
          maxLength={500}
          rows={2}
          placeholder="Bienvenue dans la campagne — … ! L'aventure commence ici !"
          className="w-full resize-y rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
      >
        {state && "ok" in state ? "Enregistré" : "Enregistrer"}
      </button>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

/**
 * Publication du wiki public (retour utilisateur : "supprimer le bouton de
 * reglages, deplacer ses options ailleurs") — ancien onglet "Publication"
 * du menu de reglages, desormais une page MJ a part entiere : `worldId`/
 * `links`/`wikiWelcomeMessage` arrivent deja resolus du rendu serveur
 * (`app/m/[worldSlug]/mj/publication/page.tsx`), plus de fetch client au
 * montage. `router.refresh()` (meme motif que `RulesetSelector`) redemande
 * ces props au serveur apres creation/revocation d'un lien.
 */
export default function PublicationPanel({
  worldId,
  worldSlug,
  initialLinks,
  initialWikiWelcomeMessage,
}: {
  worldId: string;
  worldSlug: string;
  initialLinks: ShareLinkSummary[];
  initialWikiWelcomeMessage: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="block-title text-lg">Publication</h1>
      <a
        href={`/m/${worldSlug}/apercu`}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start rounded-full border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised"
      >
        Prévisualiser ↗
      </a>
      <WikiWelcomeMessageForm worldId={worldId} initialMessage={initialWikiWelcomeMessage} />
      <ShareLinkPanel worldId={worldId} worldSlug={worldSlug} links={initialLinks} onMutated={() => router.refresh()} />
    </div>
  );
}
