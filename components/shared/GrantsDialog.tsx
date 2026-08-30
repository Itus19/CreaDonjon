"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Candidate {
  userId: string;
  displayName: string;
  granted: boolean;
}

/**
 * Raccourci sidebar MJ (V2-M9, retour utilisateur : "dans la side bar pour
 * les mj, un endroit pour selectionner les fiches et donner le droit
 * d'edition a certains membres") — meme patron d'overlay que
 * `ConfirmDialog.tsx`, mais une case a cocher par joueur plutot qu'un
 * confirmer/annuler unique : chaque bascule ecrit immediatement (POST/DELETE
 * `/api/entities/[id]/grants`), pas d'etat "brouillon" a valider en bloc.
 */
export default function GrantsDialog({
  open,
  entityId,
  entityName,
  onClose,
}: {
  open: boolean;
  entityId: string;
  entityName: string;
  onClose: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/entities/${entityId}/grant-candidates`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { candidates: Candidate[] }) => {
        setCandidates(body.candidates);
        setError(null);
      })
      .catch(() => setError("Impossible de charger la liste des joueurs."));
  }, [open, entityId]);

  async function toggle(candidate: Candidate) {
    setPendingUserId(candidate.userId);
    setError(null);
    const res = candidate.granted
      ? await fetch(`/api/entities/${entityId}/grants/${candidate.userId}`, { method: "DELETE" })
      : await fetch(`/api/entities/${entityId}/grants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: candidate.userId }),
        });
    setPendingUserId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de la mise à jour.");
      return;
    }
    setCandidates((prev) =>
      prev?.map((c) => (c.userId === candidate.userId ? { ...c, granted: !c.granted } : c)) ?? prev
    );
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Partager l'édition de ${entityName}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-edge-strong bg-panel-raised p-4 shadow-2xl"
      >
        <h2 className="text-sm font-semibold text-ink">Partager l&apos;édition de « {entityName} »</h2>
        <p className="mt-1.5 text-xs text-ink-muted">
          Les joueurs cochés peuvent éditer cette fiche, en plus de la vôtre. Toujours révocable.
        </p>

        <div className="mt-3 flex flex-col gap-1">
          {error && <p className="text-xs text-danger">{error}</p>}
          {!error && candidates === null && <p className="text-xs text-ink-muted">…</p>}
          {!error && candidates?.length === 0 && (
            <p className="text-xs text-ink-muted">Aucun joueur dans cette campagne pour l&apos;instant.</p>
          )}
          {candidates?.map((c) => (
            <label key={c.userId} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-ink hover:bg-panel">
              <input
                type="checkbox"
                checked={c.granted}
                disabled={pendingUserId === c.userId}
                onChange={() => toggle(c)}
                className="h-4 w-4 rounded border-edge"
              />
              {c.displayName}
            </label>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
