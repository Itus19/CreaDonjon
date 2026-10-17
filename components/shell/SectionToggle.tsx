"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDesktopWindowsState } from "./DesktopWindowsProvider";
import { IconeRail, RailRow } from "./Rail";
import { serializeAvecParam } from "./windowRefs";

/**
 * Logique de lien partagee par la bascule (tiroir, sous 768 px) et par les
 * trois lignes du rail (a partir de 768 px) : une seule source pour le
 * `?avec=` conserve, jamais recopiee. Exportee (V3.1-29) pour la barre
 * flottante du telephone et la pile des fiches, qui fabriquent leurs liens avec.
 */
export function useSectionLiens(worldSlug: string) {
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

  return { isMonde, isRegles, isMj, openRefs, hrefWithWindows, navigate };
}

/**
 * Monde / Regles / MJ en trois lignes du rail (V3.1-27), a partir de 768 px.
 * Meme logique de lien que `SectionToggle` ; `hidden md:flex` masque le bloc
 * sous 768 px, ou la bascule en pilule reste seule en place.
 */
export function SectionRailRows({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("shell");
  const { isMonde, isRegles, isMj, hrefWithWindows, navigate } = useSectionLiens(worldSlug);
  const sections = [
    { base: `/m/${worldSlug}`, libelle: t("monde"), actif: isMonde, icone: <IconeRail nom="maison" /> },
    { base: `/m/${worldSlug}/regles`, libelle: t("regles"), actif: isRegles, icone: <IconeRail nom="livres" /> },
    { base: `/m/${worldSlug}/mj`, libelle: t("mj"), actif: isMj, icone: <IconeRail nom="bouclier" /> },
  ];
  return (
    <div className="hidden flex-col gap-0.5 md:flex">
      {sections.map((s) => (
        <RailRow
          key={s.base}
          href={hrefWithWindows(s.base)}
          onClick={(e) => navigate(e, s.base)}
          icone={s.icone}
          libelle={s.libelle}
          actif={s.actif}
        />
      ))}
    </div>
  );
}

/**
 * Bascule Monde / Règles / MJ, en haut de la barre laterale de chaque
 * section, au-dessus de son champ de recherche (V2-K2 — quittait la barre
 * superieure). Chrome distinct par section (fenêtres flottantes pour les
 * fiches — communes à Monde et Règles depuis ADR-0011 —, sidebar d'outils
 * plein cadre pour le MJ, sans fenêtre). Le mode solo (V3) est un sujet
 * distinct, pas un onglet de plus ici.
 *
 * Changer de section est une navigation de page complète (nouvelle route),
 * ce qui remettrait `?avec=` à zéro si on n'y prenait pas garde : la
 * fenêtre primaire actuelle (si elle existe) est repliée dans `avec` et
 * la liste complète des fenêtres ouvertes suit vers la section cible,
 * pour que "changer de vue ne ferme plus les fenêtres" (V2-K1).
 */
export default function SectionToggle({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("shell");
  const { isMonde, isRegles, isMj, hrefWithWindows, navigate } = useSectionLiens(worldSlug);

  return (
    <div className="flex w-full items-center gap-1 rounded-full border border-edge p-0.5 text-xs md:hidden">
      <Link
        href={hrefWithWindows(`/m/${worldSlug}`)}
        onClick={(e) => navigate(e, `/m/${worldSlug}`)}
        className={`flex-1 rounded-full px-2 py-1 text-center transition-colors ${
          isMonde ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {t("monde")}
      </Link>
      <Link
        href={hrefWithWindows(`/m/${worldSlug}/regles`)}
        onClick={(e) => navigate(e, `/m/${worldSlug}/regles`)}
        className={`flex-1 rounded-full px-2 py-1 text-center transition-colors ${
          isRegles ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {t("regles")}
      </Link>
      <Link
        href={hrefWithWindows(`/m/${worldSlug}/mj`)}
        onClick={(e) => navigate(e, `/m/${worldSlug}/mj`)}
        className={`flex-1 rounded-full px-2 py-1 text-center transition-colors ${
          isMj ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {t("mj")}
      </Link>
    </div>
  );
}

