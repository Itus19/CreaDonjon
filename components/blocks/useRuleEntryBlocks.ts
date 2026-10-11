"use client";

import { useEffect, useState } from "react";
import { creerChargeurParLots, type ChargeurParLots } from "@/lib/chargement/chargeurParLots";

export interface RuleEntryBlockData {
  blockType: string;
  data: unknown;
}

const EMPTY: Record<string, RuleEntryBlockData[]> = {};

/** Borne du schema de la route (`ruleEntryBlocksSchema`, 1000 cles au plus). */
const TAILLE_MAX_LOT = 1000;

/**
 * Un chargeur par monde (la route est propre a un monde). Cache sans
 * peremption, comme avant V3.1-62 : le contenu d'une fiche de regle ne change
 * qu'avec le ruleset actif, et `clearRuleEntryBlocksCache` le vide alors.
 *
 * V3.1-62 (docs/CABLAGE.md, C2) : les blocs d'un meme ecran demandent leurs
 * cles ensemble, en UNE requete, au lieu d'une requete par lot de cles.
 */
const chargeurs = new Map<string, ChargeurParLots<RuleEntryBlockData[]>>();

function chargeurPour(worldSlug: string): ChargeurParLots<RuleEntryBlockData[]> {
  let chargeur = chargeurs.get(worldSlug);
  if (!chargeur) {
    chargeur = creerChargeurParLots<RuleEntryBlockData[]>({
      tailleMax: TAILLE_MAX_LOT,
      dureeCacheMs: Infinity,
      chargerLot: async (keys) => {
        const res = await fetch(`/api/worlds/${worldSlug}/rule-entry-blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys }),
        });
        if (!res.ok) throw new Error(`rule-entry-blocks : ${res.status}`);
        const body = (await res.json()) as Record<string, RuleEntryBlockData[]>;
        return new Map(Object.entries(body));
      },
    });
    chargeurs.set(worldSlug, chargeur);
  }
  return chargeur;
}

/** Meme raison que `clearWorldRuleEntriesCache` (`useWorldRuleEntries.ts`) : a appeler au changement de ruleset actif d'un monde. */
export function clearRuleEntryBlocksCache(worldSlug: string): void {
  chargeurs.get(worldSlug)?.vider();
}

export function useRuleEntryBlocks(worldSlug: string, keys: readonly string[]): Record<string, RuleEntryBlockData[]> {
  const dedupeKey = JSON.stringify([...keys].sort());
  const [data, setData] = useState<Record<string, RuleEntryBlockData[]>>(() => {
    const pret = chargeurPour(worldSlug).lireSiPret(keys);
    return pret && pret.size > 0 ? Object.fromEntries(pret) : EMPTY;
  });

  useEffect(() => {
    let cancelled = false;
    chargeurPour(worldSlug)
      .charger(keys)
      .then((resultat) => {
        if (!cancelled) setData(resultat.size === 0 ? EMPTY : Object.fromEntries(resultat));
      })
      .catch((erreur: unknown) => {
        // Jamais muet : les blocs restent vides, et l'erreur se voit.
        console.error("Blocs de regle non charges", erreur);
        if (!cancelled) setData(EMPTY);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSlug, dedupeKey]);

  return data;
}
