"use client";

import type { DerivedSheet } from "@/src/core/rules/sheet";
import type { RuntimeState } from "@/src/core/schemas/runtimeState";
import { creerChargeurParLots } from "@/lib/chargement/chargeurParLots";

/** Reponse de `GET /api/entities/[id]/sheet` : fiche derivee et etat de jeu. */
export interface SheetApiResponse {
  sheet: DerivedSheet;
  hitDiceTotals: Record<string, number>;
  runtimeState: { state: RuntimeState; hpMax: number; hitDiceTotals: Record<string, number> };
}

/**
 * V3.1-62 (docs/CABLAGE.md, C2) : la fiche lancait trois GET `/sheet`
 * identiques au montage (double montage du mode strict, plusieurs instances).
 * Le serveur les traitait a la file : le dernier finissait 8 s apres le
 * premier, et fixait la fin de l'affichage. Les demandes SIMULTANEES
 * partagent maintenant la meme attente ; aucune reponse n'est gardee en cache
 * (`dureeCacheMs: 0`), donc un rechargement apres une action repart toujours
 * au serveur.
 *
 * Module a part (pas dans `PlayableCharacterSheet`) : la page de la fiche
 * l'amorce avec sa reponse partie en flux (ADR 0056) sans importer toute la
 * fiche jouable, chargee a la demande.
 */
const chargeurFiche = creerChargeurParLots<SheetApiResponse>({
  tailleMax: 1,
  dureeCacheMs: 0,
  chargerLot: async ([cle]) => {
    const [entityId, campaignId] = JSON.parse(cle) as [string, string];
    const res = await fetch(`/api/entities/${entityId}/sheet?campaignId=${campaignId}`);
    if (!res.ok) throw new Error(`sheet : ${res.status}`);
    return new Map([[cle, (await res.json()) as SheetApiResponse]]);
  },
});

function cleFiche(entityId: string, campaignId: string | null): string {
  return JSON.stringify([entityId, campaignId ?? ""]);
}

export async function chargerFicheCalculee(entityId: string, campaignId: string | null): Promise<SheetApiResponse | undefined> {
  const cle = cleFiche(entityId, campaignId);
  return (await chargeurFiche.charger([cle])).get(cle);
}

/** La fiche calculee partie avec la page (ADR 0056) : la prochaine demande de la fiche l'attend au lieu d'appeler la route. */
export function amorcerFicheCalculee(entityId: string, campaignId: string | null, promesse: Promise<SheetApiResponse | undefined>): void {
  chargeurFiche.amorcer(cleFiche(entityId, campaignId), promesse);
}
