"use client";

import { useState } from "react";

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
 */
export default function TwoPaneReaderLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le sommaire"
        className="fixed left-3 top-3 z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md print:hidden md:hidden"
      >
        ☰
      </button>

      {open && <div className="fixed inset-0 z-40 bg-scrim md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside
        onClick={() => setOpen(false)}
        className={`no-scrollbar fixed inset-y-0 left-0 z-50 w-[280px] shrink-0 overflow-y-auto bg-panel-sunken px-4 pb-10 pt-16 transition-transform print:hidden md:static md:z-auto md:w-44 md:translate-x-0 md:bg-transparent md:px-0 md:pr-4 md:pt-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pt-14 md:border-l md:border-edge/60 md:pl-6 md:pt-0">
        <div className="mx-auto max-w-[70ch]">{children}</div>
      </main>
    </div>
  );
}
