"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * Tete des trois barres laterales (Monde, Regles, MJ) depuis V2.1-16 :
 * un bouton de sortie, le nom du monde, et sous lui le nom de la campagne
 * quand il y en a une. C'est ce qui reste de l'en-tete supprime.
 *
 * Meme disposition que le wiki public (`BookSkin.tsx`), qui n'a jamais eu
 * d'en-tete : le titre vit en tete du sommaire. La coquille joueur avait
 * deja pris ce chemin sur retour utilisateur ("retirer cette barre en haut
 * et tout mettre sur la side bar") ; les trois dernieres sections s'y
 * rangent a leur tour, et la coquille cesse d'avoir deux modeles.
 *
 * Le nom de la campagne n'est passe que par l'ecran MJ — c'est la seule
 * section ou l'en-tete l'affichait.
 */
export default function WorldSidebarHeader({
  worldSlug,
  worldName,
  campaignName,
}: {
  worldSlug: string;
  worldName: string;
  campaignName?: string | null;
}) {
  const t = useTranslations("shell");
  return (
    <div className="flex items-center gap-2">
      {/* Remplace le lien texte "Mes mondes" de l'en-tete (retour
          utilisateur : "juste un bouton avec un symbole de sortie"). Le
          libelle survit en infobulle et en nom accessible — un glyphe seul
          n'est pas un nom. */}
      <Link
        href="/"
        title={t("mesMondes")}
        aria-label={t("mesMondes")}
        className="shrink-0 rounded-full border border-edge p-1.5 text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
          <path d="M10 8l-4 4 4 4" />
          <path d="M6 12h10" />
        </svg>
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/m/${worldSlug}`}
          className="block truncate font-chrome text-sm font-semibold text-ink transition-colors hover:text-accent"
        >
          {worldName}
        </Link>
        {campaignName && <span className="block truncate text-xs text-ink-muted">{campaignName}</span>}
      </div>
    </div>
  );
}
