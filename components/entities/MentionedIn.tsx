"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MentionedInEntry {
  id: string;
  name: string;
  slug: string;
}

/**
 * Rétroliens (V2.1-1, panneau "Mentionné dans",
 * specs/wiki-liens-et-personnages.md §A2) — la liste vient déjà filtrée par
 * visibilité (RLS de `entity_mentions`, appliquée côté serveur). Masqué
 * entièrement si vide : une fiche jamais mentionnée n'a rien à montrer ici,
 * contrairement aux relations (qu'on ajoute), ce panneau ne fait qu'informer.
 */
export default function MentionedIn({
  entityId,
  worldSlug,
  hrefBase,
}: {
  entityId: string;
  /** Requis seulement si `hrefBase` est absent (repli MJ, `/m/[worldSlug]/f`). */
  worldSlug?: string;
  /** Chemin des fiches liées (ex. `/m/[worldSlug]/joueur/wiki` côté joueur, déjà fourni par les pages publiques) — sinon calculé depuis `worldSlug` (MJ, `/m/[worldSlug]/f`). */
  hrefBase?: string;
}) {
  const base = hrefBase ?? `/m/${worldSlug}/f`;
  const [entries, setEntries] = useState<MentionedInEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entities/${entityId}/mentions`)
      .then((res) => (res.ok ? res.json() : []))
      .then((body: MentionedInEntry[]) => {
        if (!cancelled) setEntries(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  if (entries.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-1.5 border-t border-edge/60 pt-2.5 text-xs">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Mentionné dans :</span>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((e) => (
          /* `prefetch={false}` (V2.1-20 lot 6) : meme raison que les mentions
             du texte (`PublicBlockView.tsx`), avec une aggravation propre a ce
             composant — sa liste arrive par un `fetch` APRES l'hydratation, si
             bien que ses liens entraient dans le champ de vision une fois la
             page deja chargee et declenchaient une SECONDE volee de
             prechargements, distincte de la premiere. */
          <Link
            key={e.id}
            href={`${base}/${e.slug}`}
            prefetch={false}
            className="rounded-full border border-edge px-2.5 py-1 text-ink transition-colors hover:bg-panel-raised"
          >
            {e.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
