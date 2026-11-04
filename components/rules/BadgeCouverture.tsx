"use client";

import { useTranslations } from "next-intl";
import type { CoverageSummary } from "@/src/core/rules/activationEditor";

// Classes écrites en toutes lettres (Tailwind) : jetons seulement, jamais une couleur de palette.
const TEINTES: Record<CoverageSummary["state"], string> = {
  playable: "border-success text-success",
  partial: "border-accent text-accent",
  unevaluated: "border-edge text-ink-muted",
};

/**
 * V3.1-132 — le badge de couverture d'une règle : Jouable, Partielle, Non évaluée.
 * Il ne révèle rien (un état et des comptes) : le joueur le voit aussi.
 */
export default function BadgeCouverture({ coverage }: { coverage: CoverageSummary }) {
  const t = useTranslations("regles.briques");
  const detail =
    coverage.state === "partial" ? t("badge.lacunes", { n: coverage.gaps }) : coverage.bricks > 0 ? t("badge.briques", { n: coverage.bricks, m: coverage.cited }) : null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TEINTES[coverage.state]}`}
      title={t(`badge.aide.${coverage.state}`)}
    >
      <span aria-hidden="true">●</span>
      {t(`badge.${coverage.state}`)}
      {detail && <span className="font-normal"> · {detail}</span>}
    </span>
  );
}
