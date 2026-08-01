"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Bascule Monde / Règles (specs/coquille-et-design.md §3) : deux sections
 * aux chrome distincts (fenêtres flottantes pour les fiches, simple liste
 * pour les règles — une règle se consulte, elle ne s'ouvre pas en
 * plusieurs fenêtres). Le mode solo viendra en V3, pas encore de troisième
 * onglet.
 */
export default function SectionToggle({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const isRegles = pathname.startsWith(`/m/${worldSlug}/regles`);

  return (
    <div className="flex items-center gap-1 rounded-full border border-edge p-0.5 text-xs">
      <Link
        href={`/m/${worldSlug}`}
        className={`rounded-full px-3 py-1 transition-colors ${
          isRegles ? "text-ink-muted hover:text-ink" : "bg-panel-raised text-ink"
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
    </div>
  );
}
