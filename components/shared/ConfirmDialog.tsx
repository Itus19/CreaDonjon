"use client";

import { createPortal } from "react-dom";

/**
 * Remplace `window.confirm` (V1-C4, bug de suppression de bloc) : la boite
 * de dialogue native du navigateur est facile a manquer — pas de couleur,
 * pas de coherence avec le reste de la coquille, et son affichage varie
 * selon le navigateur. Meme patron d'overlay que CommandPalette.tsx
 * (scrim + panneau centre, role="dialog"). z-[1100] : peut s'ouvrir
 * par-dessus un panneau deja modal (ex. EntityHistoryPanel, z-[1000]),
 * donc toujours au-dessus du plus haut z-index connu de la coquille.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-edge-strong bg-panel-raised p-4 shadow-2xl"
      >
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-1.5 text-sm text-ink-muted">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              danger
                ? "bg-danger text-accent-ink hover:opacity-90"
                : "bg-accent text-accent-ink hover:bg-accent-hover"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
