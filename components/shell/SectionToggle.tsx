"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDesktopWindowsState } from "./DesktopWindowsProvider";
import { serializeAvecParam } from "./windowRefs";

/**
 * Bascule Monde / Règles / MJ (specs/coquille-et-design.md §3) : chrome
 * distinct par section (fenêtres flottantes pour les fiches — communes à
 * Monde et Règles depuis ADR-0011 —, sidebar d'outils plein cadre pour le
 * MJ, sans fenêtre). Le mode solo (V3) est un sujet distinct, pas un
 * onglet de plus ici.
 *
 * Changer de section est une navigation de page complète (nouvelle route),
 * ce qui remettrait `?avec=` à zéro si on n'y prenait pas garde : la
 * fenêtre primaire actuelle (si elle existe) est repliée dans `avec` et
 * la liste complète des fenêtres ouvertes suit vers la section cible,
 * pour que "changer de vue ne ferme plus les fenêtres" (V2-K1).
 */
export default function SectionToggle({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const router = useRouter();
  const desktopState = useDesktopWindowsState();
  const isRegles = pathname.startsWith(`/m/${worldSlug}/regles`);
  const isMj = pathname.startsWith(`/m/${worldSlug}/mj`);
  const isMonde = !isRegles && !isMj;

  function openRefs() {
    if (!desktopState) return [];
    const refs = desktopState.avecWindows.map((w) => w.ref);
    return desktopState.primary ? [desktopState.primary.ref, ...refs] : refs;
  }

  function hrefWithWindows(base: string): string {
    const refs = openRefs();
    if (refs.length === 0) return base;
    return `${base}?avec=${encodeURIComponent(serializeAvecParam(refs))}`;
  }

  function navigate(e: React.MouseEvent, base: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    router.push(hrefWithWindows(base));
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-edge p-0.5 text-xs">
      <Link
        href={hrefWithWindows(`/m/${worldSlug}`)}
        onClick={(e) => navigate(e, `/m/${worldSlug}`)}
        className={`rounded-full px-3 py-1 transition-colors ${
          isMonde ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {t("monde")}
      </Link>
      <Link
        href={hrefWithWindows(`/m/${worldSlug}/regles`)}
        onClick={(e) => navigate(e, `/m/${worldSlug}/regles`)}
        className={`rounded-full px-3 py-1 transition-colors ${
          isRegles ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {t("regles")}
      </Link>
      <Link
        href={hrefWithWindows(`/m/${worldSlug}/mj`)}
        onClick={(e) => navigate(e, `/m/${worldSlug}/mj`)}
        className={`rounded-full px-3 py-1 transition-colors ${
          isMj ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {t("mj")}
      </Link>
    </div>
  );
}

