"use client";

import { useState } from "react";
import { useCachedGet } from "./useCachedGet";

export interface DeletedEntitySummary {
  id: string;
  name: string;
  slug: string;
  entityKind: string;
  deletedAt: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Fiches supprimées, avec un "Rétablir" par ligne (retour utilisateur,
 * Journal d'historique) — même carte que `GmJournalPanel.tsx`, même
 * `useCachedGet` (pas de flash "Chargement…" en rebasculant d'onglet).
 * `router.refresh()` après un rétablissement reste acceptable ici (pas le
 * même anti-motif que RelationsChips.tsx/EntityTree.tsx) : c'est une
 * action rare et déliberée depuis une page à part, jamais répétée en
 * rafale — contrairement à ajouter des relations ou glisser-déposer des
 * catégories.
 */
export default function DeletedEntitiesPanel({ worldSlug }: { worldSlug: string }) {
  const { data, reload } = useCachedGet<DeletedEntitySummary[]>(`deleted-entities:${worldSlug}`, `/api/worlds/${worldSlug}/deleted-entities`);
  const entities = data ?? null;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(id: string) {
    setPendingId(id);
    setError(null);
    const res = await fetch(`/api/entities/${id}/restore`, { method: "POST" });
    setPendingId(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible de rétablir cette fiche.");
      return;
    }
    reload();
    // La fiche rétablie doit réapparaître dans la barre latérale (arborescence
    // rendue par le layout serveur, `app/m/[worldSlug]/(monde)/layout.tsx`) —
    // seul un vrai rechargement de page l'atteint depuis cette page à part.
    window.location.reload();
  }

  return (
    <div className="flex h-full flex-col gap-2 rounded-2xl border border-edge bg-panel-sunken p-4">
      <h2 className="block-title text-base">Fiches supprimées</h2>
      {entities === null && <p className="text-xs text-ink-muted">…</p>}
      {entities && entities.length === 0 && <p className="text-xs text-ink-muted">Aucune fiche supprimée pour l&apos;instant.</p>}
      {entities && entities.length > 0 && (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-xs">
          {entities.map((entity) => (
            <li key={entity.id} className="flex items-center justify-between gap-2 border-b border-edge/30 pb-1">
              <span className="truncate text-ink-muted">
                {entity.name || "(sans nom)"} <span className="text-ink-muted/70">· supprimée le {formatDateTime(entity.deletedAt)}</span>
              </span>
              <button
                type="button"
                onClick={() => restore(entity.id)}
                disabled={pendingId === entity.id}
                className="shrink-0 rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
              >
                Rétablir
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
