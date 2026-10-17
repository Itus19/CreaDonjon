"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import type { EspaceRecents } from "@/lib/ui/recents";
import { SectionRecemment } from "./ListeRecents";
import ReaderHistoryNav from "./ReaderHistoryNav";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";

/**
 * Disposition a deux volets (sommaire a gauche + fiche a `max-w-[70ch]`)
 * partagee par les trois onglets Wiki/Regles/Edition de la coquille joueur
 * (`joueur/wiki/layout.tsx`, `joueur/regles/layout.tsx`,
 * `joueur/fiche/layout.tsx`) — meme sommaire fixe de 176px partout, jamais
 * responsive (retour utilisateur : "controle general... surtout pour le
 * cote joueur" — bug reel trouve en testant a 375px, meme cause que
 * `BookSkin.tsx` juste avant : le sommaire prenait la moitie de l'ecran en
 * permanence, laissant a peine de quoi lire la fiche). Extrait en un seul
 * composant plutot que duplique trois fois. L'onglet Edition avait un temps
 * son sommaire a droite (V2-M13) ; retour utilisateur, replace a gauche
 * comme les deux autres — plus besoin d'une disposition miroir ici.
 *
 * V3.1-30 : sous 768 px le tiroir de gauche devient une feuille du bas, ouverte
 * par le meme ☰ ; elle commence par « Recemment » quand `recents` est donne
 * (Regles seulement, pas Edition). A partir de 768 px, rien ne change.
 */
export default function TwoPaneReaderLayout({
  sidebar,
  recents,
  children,
}: {
  sidebar: React.ReactNode;
  /** Monde et espace des fiches consultees recemment, pour l'entree « Recemment » de la feuille. */
  recents?: { worldSlug: string; espace: EspaceRecents };
  children: React.ReactNode;
}) {
  const t = useTranslations("lecteur");
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("ouvrirSommaire")}
        className="fixed left-3 top-3 z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md print:hidden md:hidden"
      >
        ☰
      </button>

      {estTelephone && open && (
        <FeuilleDuBas titre={t("sommaire")} onFermer={() => setOpen(false)}>
          <div className="flex flex-col gap-4">
            {recents && <SectionRecemment worldSlug={recents.worldSlug} espace={recents.espace} onNavigate={() => setOpen(false)} />}
            {/* Se ferme au choix d'un lien, pas au pli d'une categorie. */}
            <div onClick={(e) => e.target instanceof Element && e.target.closest("a") && setOpen(false)}>{sidebar}</div>
          </div>
        </FeuilleDuBas>
      )}

      {!estTelephone && (
        <aside className="no-scrollbar w-44 shrink-0 overflow-y-auto pr-4 max-md:hidden print:hidden">{sidebar}</aside>
      )}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pt-14 md:border-l md:border-edge/60 md:pl-6 md:pt-0">
        <div className="mx-auto max-w-[70ch]">
          <ReaderHistoryNav />
          {children}
        </div>
      </main>
    </div>
  );
}
