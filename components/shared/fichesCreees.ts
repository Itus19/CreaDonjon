"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";

/**
 * AG-2 — une fiche créée depuis l'éditeur de texte (« Créer comme fiche »)
 * doit apparaître tout de suite dans le sommaire et dans les liens possibles,
 * sans recharger la page (docs/CABLAGE.md, C5 : un changement met à jour son
 * coin d'écran).
 *
 * L'éditeur, le sommaire et le formulaire de la fiche ne partagent aucun
 * état : le sommaire vit dans la barre, les liens possibles viennent de la
 * page. Un événement du navigateur les relie sans rien charger de plus que ce
 * qui a changé : le sommaire relit son arbre (une lecture), la liste des
 * liens ajoute la fiche reçue (aucune lecture).
 */

const EVENEMENT = "creadonjon:fiche-creee";

export function annoncerFicheCreee(fiche: OtherEntityOption): void {
  window.dispatchEvent(new CustomEvent<OtherEntityOption>(EVENEMENT, { detail: fiche }));
}

/** Appelle `action` à chaque fiche créée ailleurs sur l'écran. `action` doit être stable (`useCallback`), sinon l'écoute se réinstalle à chaque rendu. */
export function useSurFicheCreee(action: (fiche: OtherEntityOption) => void): void {
  useEffect(() => {
    function ecouter(e: Event) {
      action((e as CustomEvent<OtherEntityOption>).detail);
    }
    window.addEventListener(EVENEMENT, ecouter);
    return () => window.removeEventListener(EVENEMENT, ecouter);
  }, [action]);
}

/** La liste des fiches liables, complétée des fiches créées depuis le chargement de la page. */
export function useFichesLiables(base: OtherEntityOption[]): OtherEntityOption[] {
  const [ajoutees, setAjoutees] = useState<OtherEntityOption[]>([]);
  const ajouterSiNouvelle = useCallback((fiche: OtherEntityOption) => {
    setAjoutees((liste) => (liste.some((f) => f.id === fiche.id) ? liste : [...liste, fiche]));
  }, []);
  useSurFicheCreee(ajouterSiNouvelle);
  return useMemo(() => {
    if (ajoutees.length === 0) return base;
    const connues = new Set(base.map((f) => f.id));
    return [...base, ...ajoutees.filter((f) => !connues.has(f.id))];
  }, [base, ajoutees]);
}
