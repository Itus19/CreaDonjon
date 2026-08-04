"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Bascule Monde / Règles / MJ (specs/coquille-et-design.md §3) : chrome
 * distinct par section (fenêtres flottantes pour les fiches, simple liste
 * pour les règles, sidebar d'outils pour le MJ — campagnes aujourd'hui,
 * générateurs/bloc-notes en réserve, V2 pour la plupart). Le mode solo
 * (V3) est un sujet distinct, pas un onglet de plus ici.
 */
export default function SectionToggle({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const isRegles = pathname.startsWith(`/m/${worldSlug}/regles`);
  const isMj = pathname.startsWith(`/m/${worldSlug}/mj`);
  const isMonde = !isRegles && !isMj;

  return (
    <div className="flex items-center gap-1 rounded-full border border-edge p-0.5 text-xs">
      <Link
        href={`/m/${worldSlug}`}
        className={`rounded-full px-3 py-1 transition-colors ${
          isMonde ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {t("monde")}
      </Link>
      <Link
        href={`/m/${worldSlug}/regles`}
        className={`rounded-full px-3 py-1 transition-colors ${
          isRegles ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {t("regles")}
      </Link>
      <Link
        href={`/m/${worldSlug}/mj`}
        className={`rounded-full px-3 py-1 transition-colors ${
          isMj ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {t("mj")}
      </Link>
    </div>
  );
}
