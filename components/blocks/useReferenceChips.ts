"use client";

import { useEffect, useState } from "react";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { creerChargeurParLots, type ChargeurParLots } from "@/lib/chargement/chargeurParLots";

export interface ResolvedChipView {
  kind: "rule" | "entity";
  key: string;
  name: string;
  summary: string | null;
  href: string;
  found: boolean;
}

function refIdentity(ref: BlockReference): string {
  return ref.kind === "rule" ? `rule:${ref.key}` : `entity:${ref.id}`;
}

function refFromIdentity(identity: string): BlockReference {
  const separateur = identity.indexOf(":");
  const kind = identity.slice(0, separateur);
  const valeur = identity.slice(separateur + 1);
  return kind === "rule" ? { kind: "rule", key: valeur } : { kind: "entity", id: valeur };
}

/** Borne du schema de la route (`resolveChipsSchema`, 200 references au plus). */
const TAILLE_MAX_LOT = 200;
/**
 * Une puce resolue sert 30 s : assez pour toute la fiche et ses onglets, assez
 * court pour qu'un renommage se voie sans recharger la page (avant V3.1-62,
 * chaque bloc redemandait ses puces a chaque affichage).
 */
const DUREE_CACHE_MS = 30_000;

/** Un chargeur par monde : la route est propre a un monde. */
const chargeurs = new Map<string, ChargeurParLots<ResolvedChipView>>();

function chargeurPour(worldSlug: string): ChargeurParLots<ResolvedChipView> {
  let chargeur = chargeurs.get(worldSlug);
  if (!chargeur) {
    chargeur = creerChargeurParLots<ResolvedChipView>({
      tailleMax: TAILLE_MAX_LOT,
      dureeCacheMs: DUREE_CACHE_MS,
      chargerLot: async (identites) => {
        const res = await fetch(`/api/worlds/${worldSlug}/reference-chips`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refs: identites.map(refFromIdentity) }),
        });
        if (!res.ok) throw new Error(`reference-chips : ${res.status}`);
        const body = (await res.json()) as { chips: ResolvedChipView[] };
        return new Map(body.chips.map((c) => [`${c.kind}:${c.key}`, c]));
      },
    });
    chargeurs.set(worldSlug, chargeur);
  }
  return chargeur;
}

/**
 * Resout un lot de references en fiches d'affichage (V1-B2, specs/wiki-blocs.md
 * §4.3) : "chaque reference porte son lien". Indexe par `refIdentity` pour un
 * lookup direct depuis les editeurs (`chips.get(refIdentity(ref))`).
 *
 * V3.1-62 (docs/CABLAGE.md, C2) : tous les blocs d'un ecran passent par le
 * meme chargeur par lots — leurs references partent en UNE requete, et une
 * puce deja resolue n'est pas redemandee.
 */
export function useReferenceChips(worldSlug: string, refs: BlockReference[]): Map<string, ResolvedChipView> {
  const [chips, setChips] = useState<Map<string, ResolvedChipView>>(() => chargeurPour(worldSlug).lireSiPret(refs.map(refIdentity)) ?? new Map());
  const dedupeKey = refs.map(refIdentity).join(",");

  useEffect(() => {
    let cancelled = false;
    chargeurPour(worldSlug)
      .charger(refs.map(refIdentity))
      .then((resultat) => {
        if (!cancelled) setChips(resultat);
      })
      .catch((erreur: unknown) => {
        // Jamais muet : les puces restent vides (noms bruts), et l'erreur se voit.
        console.error("Puces de reference non chargees", erreur);
        if (!cancelled) setChips(new Map());
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSlug, dedupeKey]);

  return chips;
}

export { refIdentity };
