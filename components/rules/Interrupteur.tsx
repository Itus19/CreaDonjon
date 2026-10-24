"use client";

import type { ReactNode } from "react";

/**
 * Ligne à interrupteur (`role="switch"`) : le titre et son aide à gauche, un
 * état facultatif, puis la pastille. Même recette que « Contraste élevé » de
 * `PersonnalisationPanel.tsx`. Partagée par « Référence personnelle » et par
 * les réglages de table de l'écran Règles actives (V3.1-57).
 */
export default function Interrupteur({
  actif,
  onChange,
  titre,
  aide,
  etat,
  disabled = false,
}: {
  actif: boolean;
  onChange: () => void;
  titre: string;
  aide?: string;
  /** Un petit texte à droite du titre (par exemple qui tient la valeur). */
  etat?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      disabled={disabled}
      onClick={onChange}
      className="flex w-full min-w-0 items-center gap-3 text-left disabled:opacity-50"
    >
      <span className="flex min-w-0 flex-1 flex-col text-sm text-ink">
        {titre}
        {aide && <small className="text-xs text-ink-muted">{aide}</small>}
      </span>
      {etat}
      <span
        className={`relative h-[18px] w-[30px] shrink-0 rounded-full border transition-colors motion-reduce:transition-none ${actif ? "border-accent bg-accent" : "border-edge-strong bg-edge"}`}
      >
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-panel transition-all motion-reduce:transition-none ${actif ? "left-[15px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
