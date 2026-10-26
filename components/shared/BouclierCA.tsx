import type { ReactNode } from "react";

/**
 * Le bouclier de CA de la fiche (V3.1-26), extrait de `RangeeChiffree` par
 * V3.1-79 pour que la fiche de créature montre le même : libellé au-dessus,
 * écusson de 48 x 56 px. `children` est la valeur (absente : écusson creux,
 * l'état de chargement de la fiche de personnage). `titre` est l'infobulle,
 * propre à chaque fiche (le personnage calcule sa CA, la créature la porte).
 */
export default function BouclierCA({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1">
      <span className="flex h-8 items-end justify-center text-xs font-bold uppercase tracking-wide text-ink-muted">CA</span>
      <div
        className="relative flex h-14 w-12 items-center justify-center border-2 border-accent bg-panel-raised"
        style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
        title={titre}
      >
        {children}
      </div>
    </div>
  );
}
