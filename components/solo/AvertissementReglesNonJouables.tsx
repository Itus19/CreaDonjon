"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { UnplayableRule } from "@/src/server/services/rulePlayableBlocks";

/**
 * V3.1-132 (ADR 0059 §3) — le mode solo avertit avant qu'une règle de la fiche
 * ne soit jouée à la main : un bandeau repliable au-dessus du jeu, avec un lien
 * vers chaque fiche. Il ne dit que le nom et l'état d'une règle que le joueur
 * lit déjà dans son onglet Règles.
 */
export default function AvertissementReglesNonJouables({ worldSlug, regles }: { worldSlug: string; regles: UnplayableRule[] }) {
  const t = useTranslations("regles.briques");
  if (regles.length === 0) return null;
  return (
    <details className="shrink-0 border-b border-edge bg-panel-sunken px-4 py-2 text-sm" role="status">
      <summary className="cursor-pointer text-ink">{t("solo.titre", { n: regles.length })}</summary>
      <p className="mt-2 text-xs text-ink-muted">{t("solo.aide")}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {regles.map((r) => (
          <li key={r.key}>
            <Link
              href={`/m/${encodeURIComponent(worldSlug)}/regles/${encodeURIComponent(r.key)}`}
              className="inline-block rounded-full border border-edge px-3 py-1 text-xs text-link-rule transition-colors hover:bg-panel-raised"
            >
              {r.name}
              <span className="text-ink-muted"> · {r.state === "partial" ? t("badge.partial") : t("badge.unevaluated")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
