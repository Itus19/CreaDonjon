"use client";

import type { ReactNode } from "react";

/**
 * Éléments de filtre du journal historique (V3.1-61) : la puce de l'écran
 * large et la case à cocher de la feuille du bas. Les nombres sont fournis
 * par l'appelant (ils suivent les autres filtres, voir `lib/ui/journalHistorique.ts`).
 */

export function Puce({
  actif,
  onClick,
  compte,
  avatar,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  compte: number;
  /** Initiale ou glyphe ✦ affiché dans un petit rond. */
  avatar?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
        actif ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-soft hover:bg-panel-raised"
      }`}
    >
      {avatar !== undefined && (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-edge-strong bg-panel-raised text-xs font-semibold text-ink"
        >
          {avatar}
        </span>
      )}
      {children}
      <span className="tabular-nums text-ink-muted">{compte}</span>
    </button>
  );
}

/** Une rangée « libellé + puces » de l'écran large. */
export function RangeeFiltre({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-20 shrink-0 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{libelle}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Case à cocher de la feuille du bas (téléphone) : libellé et nombre. */
export function CaseFacette({ actif, onClick, compte, children }: { actif: boolean; onClick: () => void; compte: number; children: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={actif}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left text-sm text-ink transition-colors hover:bg-panel-sunken"
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
          actif ? "border-accent bg-accent text-accent-ink" : "border-edge-strong"
        }`}
      >
        {actif ? "✓" : ""}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className="tabular-nums text-xs text-ink-muted">{compte}</span>
    </button>
  );
}
