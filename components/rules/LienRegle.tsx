"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useOpenRuleLink } from "@/components/shell/useOpenRuleLink";

/**
 * Renvoi vers une règle (V3.1-94) : un toucher l'ouvre dans le volet de droite
 * (V3.1-20, `?avec=`), sans changer la règle du volet principal. Hors bureau
 * (téléphone, page du joueur), c'est un lien ordinaire vers la page de la règle.
 * `chemin` (renvoi entrant) ajoute `?path=` au lien ordinaire seulement.
 */
export default function LienRegle({
  worldSlug,
  ruleKey,
  chemin,
  className,
  style,
  onClick,
  dataRefPath,
  children,
}: {
  worldSlug: string;
  ruleKey: string;
  chemin?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent) => void;
  dataRefPath?: string;
  children: ReactNode;
}) {
  const lien = useOpenRuleLink(worldSlug, ruleKey);
  const href = chemin ? `/m/${worldSlug}/regles/${ruleKey}?path=${encodeURIComponent(chemin)}` : `/m/${worldSlug}/regles/${ruleKey}`;
  return (
    <Link
      href={href}
      data-ref-path={dataRefPath}
      className={`underline decoration-dotted underline-offset-[3px] ${className ?? ""}`}
      style={style}
      onClick={(e) => {
        onClick?.(e);
        lien.onClick(e);
      }}
    >
      {children}
    </Link>
  );
}
