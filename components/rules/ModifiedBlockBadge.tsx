"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { BlockType } from "@/src/core/schemas/rule-blocks";
import { renderBlockData } from "./blockContentRenderer";

/**
 * "Modifiee dans ta variante" (V1-A4, SCHEMA.md §9.4) : enveloppe un bloc
 * touche par une surcharge de la variante courante avec un badge qui ouvre
 * une comparaison original/variante. Un composant client entier (pas juste
 * le bouton) : le panneau de comparaison doit s'afficher sous l'en-tete,
 * jamais a l'interieur d'un <h3>/<summary> — l'etat d'ouverture doit donc
 * envelopper les deux, pas seulement le bouton. renderBlockData est
 * reutilise tel quel pour les deux cotes — jamais un deuxieme mapping bloc
 * -> mise en page pour la comparaison.
 */
export default function ModifiedBlockBadge({
  label,
  collapsed,
  blockType,
  currentData,
  originalData,
  worldSlug,
  children,
}: {
  label: ReactNode;
  collapsed?: boolean;
  blockType: BlockType;
  currentData: unknown;
  originalData: unknown;
  worldSlug: string;
  children: ReactNode;
}) {
  const t = useTranslations("regles");
  const [open, setOpen] = useState(false);

  const header = (
    <>
      {label}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-accent/60 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/10"
      >
        {t("modifieeDansTaVariante")}
      </button>
    </>
  );

  const comparison = open && (
    <div className="mt-2 grid w-full grid-cols-1 gap-4 rounded-md border border-edge/60 bg-panel-sunken p-3 text-sm sm:grid-cols-2">
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{t("original")}</div>
        {renderBlockData(blockType, originalData)}
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{t("variante")}</div>
        {renderBlockData(blockType, currentData, worldSlug)}
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <details className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
        <summary className="block-title mb-2 flex items-center gap-2 cursor-pointer">{header}</summary>
        {children}
        {comparison}
      </details>
    );
  }
  return (
    <div className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
      <h3 className="block-title mb-2 flex items-center gap-2">{header}</h3>
      {children}
      {comparison}
    </div>
  );
}
