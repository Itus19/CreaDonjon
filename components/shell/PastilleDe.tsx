"use client";

import { useTranslations } from "next-intl";
import { useSauvegardes } from "./SauvegardesProvider";

/**
 * V3.1-112 — la pastille du dé encoché : les sauvegardes et réactions à répondre, où qu'on
 * soit. Même recette que la pastille du chat (fond d'accent, texte d'accent).
 * Elle se pose dans un bouton déjà positionné (`relative`/`absolute`) ; elle est
 * muette pour les lecteurs d'écran, le bouton porte le nombre (`useLibelleDe`).
 * Rien sans demande.
 */
export default function PastilleDe({ className = "" }: { className?: string }) {
  const { compte, compteReactions } = useSauvegardes();
  const total = compte + compteReactions;
  if (total <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={`absolute z-[6] rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold leading-none text-accent-ink ${className}`}
    >
      {total}
    </span>
  );
}

/** Le nom accessible du dé : « Ouvrir le volet de dés · 2 sauvegardes à répondre ». */
export function useLibelleDe(base: string): string {
  const t = useTranslations("sauvegardes");
  const { compte, compteReactions } = useSauvegardes();
  return [base, compte > 0 ? t("pastille", { n: compte }) : null, compteReactions > 0 ? t("pastilleReactions", { n: compteReactions }) : null]
    .filter((x): x is string => x !== null)
    .join(" · ");
}
