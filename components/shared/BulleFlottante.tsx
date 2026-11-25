"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Une bulle qui s'ouvre AU-DESSUS de son déclencheur, par-dessus ce qui est
 * derrière, sans pousser la mise en page. Née pour la barre d'intention du
 * solo : la correction, le détail du fournisseur d'IA, qui allongeaient le
 * cadre de saisie à chaque ouverture et faisaient sauter le fil.
 *
 * À poser dans un conteneur `relative` qui enveloppe le déclencheur : la bulle
 * s'aligne sur son bord gauche (`debut`) ou droit (`fin`), et sa pointe vise le
 * déclencheur. Elle se ferme d'un clic dehors ou avec Échap (charte §6).
 *
 * Un clic dans un menu de `Dropdown` posé DANS la bulle ne la ferme pas : ce
 * menu vit dans un portail (`document.body`), donc hors de la bulle pour le
 * DOM ; on le reconnaît à son `role="listbox"`.
 *
 * Style : celui de tout ce qui flotte (charte §3, « Panneau, carte ») —
 * `border-edge-strong bg-panel-raised shadow-2xl`.
 */
export default function BulleFlottante({
  ouverte,
  onFermer,
  alignement,
  "aria-label": ariaLabel,
  className,
  children,
}: {
  ouverte: boolean;
  onFermer: () => void;
  alignement: "debut" | "fin";
  /** Ce que la bulle contient (« Correction de l'action »), pour un lecteur d'écran. */
  "aria-label": string;
  /** MISE EN PAGE uniquement : une largeur. */
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouverte) return;
    function surMouseDown(e: MouseEvent) {
      const cible = e.target as Element | null;
      if (!cible) return;
      if (ref.current?.contains(cible)) return;
      // Le déclencheur est le voisin de la bulle dans le conteneur `relative` :
      // son propre clic bascule déjà l'état, ne pas le refermer ici avant lui.
      if (ref.current?.parentElement?.contains(cible)) return;
      if (cible.closest('[role="listbox"]')) return;
      onFermer();
    }
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("mousedown", surMouseDown);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surMouseDown);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouverte, onFermer]);

  if (!ouverte) return null;

  const cote = alignement === "debut" ? "left-0" : "right-0";
  const cotePointe = alignement === "debut" ? "left-3" : "right-3";

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={ariaLabel}
      className={`absolute bottom-full z-30 mb-2 w-max max-w-[min(26rem,calc(100vw-2rem))] rounded-md border border-edge-strong bg-panel-raised p-3 text-sm text-ink shadow-2xl ${cote}${className ? ` ${className}` : ""}`}
    >
      {children}
      <span
        aria-hidden="true"
        className={`absolute top-full h-2.5 w-2.5 -translate-y-1.5 rotate-45 border-b border-r border-edge-strong bg-panel-raised ${cotePointe}`}
      />
    </div>
  );
}
