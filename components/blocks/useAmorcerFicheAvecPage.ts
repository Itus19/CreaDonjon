"use client";

import { useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import { rulesetSelectionFromBlocks, selectionHasAnything, selectionKey } from "@/lib/resolvedRuleset/selection";
import { amorcerFicheCalculee, type SheetApiResponse } from "./ficheCalculee";
import { amorcerRulesetResolu, type ResolvedRulesetView } from "./useResolvedRuleset";

/**
 * Ce que la page de la fiche a lance avec elle (`chargerFicheAvecPage`,
 * serveur) : les reponses de `/sheet` et de `/resolved-ruleset`.
 */
export interface FicheAvecPage {
  remote: SheetApiResponse | null;
  ruleset: { cleSelection: string; vue: ResolvedRulesetView } | null;
}

/** Une promesse n'amorce qu'une fois (double rendu du mode strict, remontage). */
const dejaAmorcees = new WeakSet<object>();

/**
 * V3.1-62 (ADR 0056, docs/CABLAGE.md C1) — la promesse partie avec la page
 * amorce les chargeurs de la fiche AVANT que ses enfants ne lancent leurs
 * propres demandes (elles partent dans leurs effets, apres ce rendu) : la
 * fiche attend alors cette promesse au lieu d'appeler les routes. La cle du
 * ruleset est recalculee ici sur les memes blocs que le serveur
 * (`rulesetSelectionFromBlocks`) ; si elle differe, la reponse est ignoree
 * et la fiche demande la sienne, comme avant.
 */
export function useAmorcerFicheAvecPage(params: {
  worldSlug: string;
  entityId: string;
  blocks: readonly { blockType: string; data: unknown }[];
  promesse: Promise<FicheAvecPage> | null;
}): void {
  // Initialiseur de `useState` : execute une seule fois, pendant le premier
  // rendu, donc avant tout effet des enfants (ou partent leurs demandes).
  useState(() => {
    // Jamais pendant le rendu serveur : ces chargeurs sont des modules du
    // navigateur, partages par tout l'onglet ; sur le serveur, ils le
    // seraient entre toutes les requetes, donc entre les utilisateurs.
    if (typeof window === "undefined") return null;
    const recue = params.promesse;
    if (!recue || dejaAmorcees.has(recue)) return null;
    dejaAmorcees.add(recue);
    // La promesse recue du serveur est reconstruite par React en simple
    // « thenable » : son `then` appelle bien les rappels, mais ne RENVOIE
    // rien. `Promise.resolve` en fait une vraie promesse, que l'on peut
    // enchainer (constate le 11 octobre : sans cela, la fiche attendait sans fin).
    const promesse = Promise.resolve(recue);

    const character = params.blocks.find((b) => b.blockType === "character")?.data as CharacterBlockData | undefined;
    const inventory = params.blocks.find((b) => b.blockType === "inventory")?.data as InventoryBlockData | undefined;
    const spellcasting = params.blocks.find((b) => b.blockType === "spellcasting")?.data as SpellcastingBlockData | undefined;
    const selection = rulesetSelectionFromBlocks(character, inventory, spellcasting);
    const cle = selectionKey(selection);

    amorcerFicheCalculee(
      params.entityId,
      null,
      promesse.then((fiche) => fiche.remote ?? undefined)
    );
    if (selectionHasAnything(selection)) {
      amorcerRulesetResolu(
        params.worldSlug,
        cle,
        promesse.then((fiche) => (fiche.ruleset && fiche.ruleset.cleSelection === cle ? fiche.ruleset.vue : undefined))
      );
    }
    return null;
  });
}
