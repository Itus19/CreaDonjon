"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

interface RevisionSummary {
  id: string;
  revision_number: number;
  change_source: "user" | "ai" | "import" | "system";
  change_note: string | null;
  created_at: string;
}

interface EntityFieldChange {
  field: "name" | "entityKind" | "aliases";
  before: string | string[];
  after: string | string[];
}

interface BlockDiffEntry {
  id: string;
  status: "added" | "removed" | "changed";
  blockType: string;
  label: string;
}

interface EntitySnapshotDiff {
  entityChanges: EntityFieldChange[];
  blocks: BlockDiffEntry[];
}

const CHANGE_SOURCE_LABELS: Record<RevisionSummary["change_source"], string> = {
  user: "Édition manuelle",
  ai: "IA",
  import: "Import",
  system: "Système",
};

const FIELD_LABELS: Record<EntityFieldChange["field"], string> = {
  name: "Nom",
  entityKind: "Type",
  aliases: "Alias",
};

const BLOCK_STATUS_LABELS: Record<BlockDiffEntry["status"], string> = {
  added: "Ajouté",
  removed: "Supprimé",
  changed: "Modifié",
};

function formatFieldValue(value: string | string[]): string {
  return Array.isArray(value) ? (value.length > 0 ? value.join(", ") : "(aucun)") : value;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Panneau d'historique du wiki (V1-C3) : liste des revisions d'une entite,
 * comparaison de deux d'entre elles, restauration. Modale simple plutot que
 * fenetre flottante — vue ponctuelle, pas un contenu qu'on garde ouvert a
 * cote d'autres fiches comme le systeme de fenetres.
 */
export default function EntityHistoryPanel({ entityId }: { entityId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [diff, setDiff] = useState<EntitySnapshotDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<number | null>(null);

  async function openPanel() {
    setOpen(true);
    setDiff(null);
    setSelected([]);
    setError(null);
    const res = await fetch(`/api/entities/${entityId}/revisions`);
    if (res.ok) setRevisions(await res.json());
  }

  function toggleSelected(revisionNumber: number) {
    setDiff(null);
    setSelected((prev) => {
      if (prev.includes(revisionNumber)) return prev.filter((n) => n !== revisionNumber);
      if (prev.length >= 2) return [prev[1], revisionNumber];
      return [...prev, revisionNumber];
    });
  }

  async function compare() {
    if (selected.length !== 2) return;
    setPending(true);
    setError(null);
    const [a, b] = [...selected].sort((x, y) => x - y);
    const res = await fetch(`/api/entities/${entityId}/revisions/compare?from=${a}&to=${b}`);
    setPending(false);
    if (!res.ok) {
      setError("Comparaison impossible.");
      return;
    }
    setDiff(await res.json());
  }

  async function restore(revisionNumber: number) {
    setPendingRestore(null);
    setPending(true);
    setError(null);
    const res = await fetch(`/api/entities/${entityId}/revisions/${revisionNumber}/restore`, { method: "POST" });
    setPending(false);
    if (!res.ok) {
      setError("Restauration impossible.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        title="Historique"
        aria-label="Historique"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-edge text-xs text-ink-muted transition-colors hover:border-edge-strong hover:text-ink"
      >
        ⧗
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-scrim p-4"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[80vh] w-full max-w-lg flex-col gap-3 overflow-hidden rounded-xl border border-edge-strong bg-panel-raised p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Historique de la fiche</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="text-ink-muted hover:text-ink"
                >
                  ×
                </button>
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}

              <p className="text-xs text-ink-muted">
                Sélectionnez deux révisions pour les comparer, ou restaurez-en une directement.
              </p>

              <div className="flex flex-col gap-1 overflow-y-auto">
                {revisions === null && <p className="text-xs text-ink-muted">Chargement…</p>}
                {revisions?.length === 0 && <p className="text-xs text-ink-muted">Aucune révision.</p>}
                {revisions?.map((revision) => (
                  <div
                    key={revision.id}
                    className="flex items-center gap-2 rounded-md border border-edge px-2.5 py-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(revision.revision_number)}
                      onChange={() => toggleSelected(revision.revision_number)}
                      aria-label={`Sélectionner la révision ${revision.revision_number}`}
                    />
                    <span className="font-mech text-ink-muted">#{revision.revision_number}</span>
                    <span className="flex-1 text-ink">
                      {formatDate(revision.created_at)} — {CHANGE_SOURCE_LABELS[revision.change_source]}
                      {revision.change_note ? ` (${revision.change_note})` : ""}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setPendingRestore(revision.revision_number)}
                      className="rounded-md px-2 py-0.5 text-ink-muted transition-colors hover:bg-panel hover:text-accent disabled:opacity-50"
                    >
                      Restaurer
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={selected.length !== 2 || pending}
                onClick={compare}
                className="w-fit rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50"
              >
                Comparer la sélection
              </button>

              {diff && (
                <div className="flex flex-col gap-2 overflow-y-auto rounded-md border border-edge bg-panel-sunken p-3 text-xs">
                  {diff.entityChanges.length === 0 && diff.blocks.length === 0 && (
                    <p className="text-ink-muted">Aucune différence visible.</p>
                  )}
                  {diff.entityChanges.map((change) => (
                    <p key={change.field}>
                      <span className="font-semibold text-ink">{FIELD_LABELS[change.field]} : </span>
                      <span className="text-ink-muted">{formatFieldValue(change.before)}</span>
                      {" → "}
                      <span className="text-ink">{formatFieldValue(change.after)}</span>
                    </p>
                  ))}
                  {diff.blocks.map((block) => (
                    <p key={block.id}>
                      <span className="font-semibold text-ink">{BLOCK_STATUS_LABELS[block.status]} : </span>
                      <span className="text-ink-muted">{block.label || block.blockType}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      <ConfirmDialog
        open={pendingRestore !== null}
        title="Restaurer cette révision ?"
        message={`Le contenu actuel de la fiche sera remplacé par la révision #${pendingRestore}.`}
        confirmLabel="Restaurer"
        danger
        onConfirm={() => pendingRestore !== null && restore(pendingRestore)}
        onCancel={() => setPendingRestore(null)}
      />
    </>
  );
}
