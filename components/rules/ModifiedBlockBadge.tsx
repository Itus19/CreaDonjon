"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { BlockType } from "@/src/core/schemas/rule-blocks";
import Tabs from "@/components/shared/Tabs";
import { renderBlockData } from "./blockContentRenderer";

/**
 * "Modifiee dans ta variante" (V1-A4, SCHEMA.md §9.4, V3.1-94) : enveloppe un
 * bloc touche par une surcharge de la variante courante. Le badge dit que le
 * bloc est modifie ; la bascule **Officiel / Ta variante** (pilule glissante)
 * donne a lire l'une ou l'autre version. LECTURE seule : aucun appel reseau,
 * rien n'est ecrit. renderBlockData est reutilise tel quel pour la version
 * officielle — jamais un deuxieme mapping bloc -> mise en page.
 */
export default function ModifiedBlockBadge({
  label,
  collapsed,
  blockType,
  originalData,
  worldSlug,
  children,
}: {
  label: ReactNode;
  collapsed?: boolean;
  blockType: BlockType;
  originalData: unknown;
  worldSlug: string;
  /** Le rendu de la donnee de la variante (version affichee par defaut). */
  children: ReactNode;
}) {
  const t = useTranslations("regles");
  const [version, setVersion] = useState<"variante" | "officiel">("variante");

  const header = (
    <>
      {label}
      <span className="rounded-full border border-accent/60 px-2 py-0.5 text-[10px] font-medium text-accent">
        {t("modifieeDansTaVariante")}
      </span>
    </>
  );

  const bascule = (
    <Tabs
      value={version}
      onChange={setVersion}
      aria-label={t("basculeVersion")}
      className="mb-2"
      items={[
        { value: "officiel", label: t("officiel") },
        { value: "variante", label: t("taVariante") },
      ]}
    />
  );
  const contenu = version === "officiel" ? renderBlockData(blockType, originalData, worldSlug) : children;

  if (collapsed) {
    return (
      <details className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
        <summary className="block-title mb-2 flex items-center gap-2 cursor-pointer">{header}</summary>
        {bascule}
        {contenu}
      </details>
    );
  }
  return (
    <div className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
      <h3 className="block-title mb-2 flex items-center gap-2">{header}</h3>
      {bascule}
      {contenu}
    </div>
  );
}
