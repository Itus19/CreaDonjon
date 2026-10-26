"use client";

import { useEffect, useState } from "react";
import { etatDe } from "@/lib/ui/outilDes";
import { RAFRAICHISSEMENT_BRUIT_MS } from "@/lib/ui/animationDe";

/**
 * Chiffres flous qui défilent (décoratifs : `Math.random` n'est JAMAIS un
 * résultat affiché comme tel — le serveur seul tire, règle 8). Un nombre par
 * dé, de `1` à son nombre de faces. Extrait d'`OutilDes.tsx` (V3.1-75) : le
 * même scintillement sert l'outil de dés et la Table aléatoire.
 */
export function useBruit(faces: number[], actif: boolean): number[] {
  const [bruit, setBruit] = useState<number[]>([]);
  const cle = faces.join(",");
  useEffect(() => {
    if (!actif || cle === "") return;
    const liste = cle.split(",").map(Number);
    const id = setInterval(() => setBruit(liste.map((f) => 1 + Math.floor(Math.random() * f))), RAFRAICHISSEMENT_BRUIT_MS);
    return () => clearInterval(id);
  }, [actif, cle]);
  return bruit;
}

/**
 * Un dé : vide et flou tant qu'il défile (`valeur` absente), puis son chiffre
 * figé — bord ambre au maximum, rouge sur un 1. Dans une paire, `retenu` dit
 * s'il est celui qui compte.
 */
export function CarreDe({
  faces,
  valeur,
  bruit,
  petit,
  retenu,
  libelleRetenu,
}: {
  faces: number;
  valeur: number | undefined;
  bruit: number | undefined;
  petit: boolean;
  /** Dans une paire : ce dé est-il celui qui compte ? Absent hors paire. */
  retenu?: boolean | undefined;
  libelleRetenu?: string;
}) {
  const taille = petit ? "h-7 w-7 text-xs" : "h-10 w-10 text-base";
  if (valeur === undefined) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border border-dashed border-edge-strong font-mech font-semibold text-ink-muted ${taille}`}
        aria-hidden="true"
      >
        {bruit !== undefined && <span className="blur-[2px]">{bruit}</span>}
      </div>
    );
  }
  const etat = etatDe(valeur, faces);
  const couleur = etat === "maximum" ? "border-accent text-accent" : etat === "un" ? "border-danger text-danger" : "border-edge-strong text-ink";
  const paire = retenu === undefined ? "" : retenu ? "ring-2 ring-accent ring-offset-1 ring-offset-panel-sunken" : "opacity-40";
  return (
    <div
      className={`flex items-center justify-center rounded-md border bg-panel-raised font-mech font-bold ${taille} ${couleur} ${paire}`}
      title={retenu ? libelleRetenu : undefined}
    >
      {valeur}
    </div>
  );
}
