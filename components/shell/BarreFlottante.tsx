"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CLASSE_FOND_DE, IconeDe } from "./Rail";
import { useDiceRoll } from "./DiceRollPanel";
import PastilleDe, { useLibelleDe } from "./PastilleDe";

/**
 * Hauteur reservee en bas du contenu des pages, sous 768 px, pour que rien ne
 * passe sous la barre flottante : barre (~67 px) + marge de 14 px + un peu d'air,
 * plus la zone sure des telephones a encoche. A poser sur la zone qui defile.
 */
export const RESERVE_BARRE = "max-md:pb-[calc(96px+env(safe-area-inset-bottom))]";

/** Une entree de la barre : un lien (`href`) ou un bouton qui ouvre une feuille. */
export interface EntreeBarre {
  cle: string;
  libelle: string;
  /** Icone au trait, prend la taille de son conteneur (20 px). */
  icone: React.ReactNode;
  actif: boolean;
  badge?: number;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  /** Le bouton ouvre une feuille du bas (lecteurs d'ecran). */
  ouvreFeuille?: boolean;
}

function Entree({ entree }: { entree: EntreeBarre }) {
  const classe = `relative flex min-w-0 flex-col items-center gap-[3px] rounded-2xl px-0.5 py-1.5 text-xs transition-colors ${
    entree.actif ? "text-accent" : "text-ink-muted hover:text-ink"
  }`;
  const contenu = (
    <>
      {entree.actif && <span className="absolute left-1/2 top-px h-1 w-1 -translate-x-1/2 rounded-full bg-accent" aria-hidden="true" />}
      <span className="relative mt-[3px] block h-5 w-5 shrink-0">
        {entree.icone}
        {!!entree.badge && entree.badge > 0 && (
          <span className="absolute -right-2 -top-1.5 rounded-full bg-accent px-1 text-xs font-semibold leading-tight text-accent-ink">
            {entree.badge}
          </span>
        )}
      </span>
      <span className="max-w-full truncate leading-tight">{entree.libelle}</span>
    </>
  );
  if (entree.href !== undefined) {
    return (
      <Link
        href={entree.href}
        onClick={entree.onClick}
        prefetch={false}
        aria-current={entree.actif ? "page" : undefined}
        className={classe}
      >
        {contenu}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={entree.onClick}
      aria-haspopup={entree.ouvreFeuille ? "dialog" : undefined}
      aria-expanded={entree.ouvreFeuille ? entree.actif : undefined}
      className={classe}
    >
      {contenu}
    </button>
  );
}

/**
 * Barre du bas flottante du telephone (V3.1-29), sous 768 px seulement :
 * trois entrees, le de encoche au centre, trois entrees. Commune au MJ
 * (`BarreTelephoneMj`) et au joueur (`PlayerShell`), qui disent chacun leurs
 * six entrees. Le de ouvre le volet de lancer existant (`ouvrirVolet`).
 *
 * Monter cette barre retire le bouton de des flottant sur telephone
 * (`enregistrerDalle("telephone")`) : le de est desormais dans la barre.
 */
export default function BarreFlottante({ entrees, libelle }: { entrees: EntreeBarre[]; libelle: string }) {
  const t = useTranslations("shell");
  const { ouvrirVolet, enregistrerDalle } = useDiceRoll();
  const libelleDe = useLibelleDe(t("ouvrirVoletDes"));
  useEffect(() => enregistrerDalle("telephone"), [enregistrerDalle]);

  return (
    <nav
      aria-label={libelle}
      className="fixed inset-x-[14px] bottom-[calc(14px+env(safe-area-inset-bottom))] z-[45] rounded-[22px] border border-edge bg-panel px-1 py-2 shadow-2xl backdrop-blur-[var(--blur)] md:hidden print:hidden"
    >
      {/* Anneau de 6 px couleur du panneau : le de parait decoupe dans le bord haut. */}
      <button
        type="button"
        onClick={ouvrirVolet}
        aria-label={libelleDe}
        className={`absolute left-1/2 top-0 z-[5] flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[6px] border-panel ${CLASSE_FOND_DE} transition-transform active:scale-95 motion-reduce:transition-none`}
      >
        <IconeDe />
        <PastilleDe className="-right-2 -top-2" />
      </button>
      <div className="grid grid-cols-[1fr_1fr_1fr_56px_1fr_1fr_1fr]">
        {entrees.slice(0, 3).map((e) => (
          <Entree key={e.cle} entree={e} />
        ))}
        <span aria-hidden="true" />
        {entrees.slice(3).map((e) => (
          <Entree key={e.cle} entree={e} />
        ))}
      </div>
    </nav>
  );
}
