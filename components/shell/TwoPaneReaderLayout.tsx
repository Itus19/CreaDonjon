"use client";

import { useState } from "react";

/**
 * Disposition a deux volets (sommaire + fiche a `max-w-[70ch]`) partagee par
 * les onglets Wiki et Regles de la coquille joueur (`joueur/wiki/layout.tsx`,
 * `joueur/regles/layout.tsx`) — meme sommaire fixe de 176px dans les deux,
 * jamais responsive (retour utilisateur : "controle general... surtout pour
 * le cote joueur" — bug reel trouve en testant a 375px, meme cause que
 * `BookSkin.tsx` juste avant : le sommaire prenait la moitie de l'ecran en
 * permanence, laissant a peine de quoi lire la fiche). Extrait en un seul
 * composant plutot que duplique deux fois (les deux `layout.tsx`
 * documentaient deja explicitement "meme disposition que...").
 */
export default function TwoPaneReaderLayout({
  sidebar,
  children,
  side = "left",
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** Édition (V2-M13, retour utilisateur : "la liste à droite des fiches...") — même disposition que Wiki/Règles, sommaire à droite plutôt qu'à gauche. */
  side?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const isRight = side === "right";

  return (
    <div className={`flex h-full min-h-0 ${isRight ? "flex-row-reverse" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le sommaire"
        className={`fixed top-3 z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md print:hidden md:hidden ${isRight ? "right-3" : "left-3"}`}
      >
        ☰
      </button>

      {open && <div className="fixed inset-0 z-40 bg-scrim md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside
        onClick={() => setOpen(false)}
        className={`no-scrollbar fixed inset-y-0 z-50 w-[280px] shrink-0 overflow-y-auto bg-panel-sunken px-4 pb-10 pt-16 transition-transform print:hidden md:static md:z-auto md:w-44 md:translate-x-0 md:bg-transparent md:px-0 md:pt-0 ${
          isRight ? "right-0 md:pl-4" : "left-0 md:pr-4"
        } ${open ? "translate-x-0" : isRight ? "translate-x-full" : "-translate-x-full"}`}
      >
        {sidebar}
      </aside>
      <main
        className={`min-h-0 min-w-0 flex-1 overflow-y-auto pt-14 md:pt-0 ${isRight ? "md:border-r md:border-edge/60 md:pr-6" : "md:border-l md:border-edge/60 md:pl-6"}`}
      >
        <div className="mx-auto max-w-[70ch]">{children}</div>
      </main>
    </div>
  );
}
