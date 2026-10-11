import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import { rulesetSelectionFromBlocks, selectionBody, selectionHasAnything, selectionKey } from "@/lib/resolvedRuleset/selection";
import { getOrInitializeRuntimeState, resolveCharacterActionContext, type RuntimeStateView } from "@/src/server/services/characterActions";
import { buildResolvedRulesetView } from "@/src/server/services/resolvedRuleset";
import { canUserEditEntityById } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-62 (ADR 0056, docs/CABLAGE.md C1) — ce que la fiche de personnage
 * demandait apres l'affichage, calcule par la page en meme temps qu'elle :
 * - `remote` : la reponse de `GET /api/entities/[id]/sheet` (fiche derivee
 *   et etat de jeu, hors campagne comme sur la page de la fiche) ;
 * - `ruleset` : la reponse de `POST .../resolved-ruleset`, avec la cle de la
 *   selection pour que la fiche la reconnaisse (`selectionKey`).
 *
 * Memes droits que les deux routes : le client Supabase de l'appelant (RLS),
 * et l'etat de jeu initial n'est enregistre que pour qui peut editer la
 * fiche (V3.1-108). `null` partout ou la route aurait repondu « introuvable ».
 */
export interface FicheAvecPage {
  remote: { sheet: DerivedSheet; hitDiceTotals: Record<string, number>; runtimeState: RuntimeStateView } | null;
  ruleset: { cleSelection: string; vue: Awaited<ReturnType<typeof buildResolvedRulesetView>> } | null;
}

export async function chargerFicheAvecPage(
  supabase: TypedClient,
  params: {
    worldId: string;
    entityId: string;
    userId: string;
    locale: Locale;
    character: CharacterBlockData;
    inventory: InventoryBlockData | undefined;
    spellcasting: SpellcastingBlockData | undefined;
  }
): Promise<FicheAvecPage> {
  const selection = rulesetSelectionFromBlocks(params.character, params.inventory, params.spellcasting);

  const remotePromise = (async (): Promise<FicheAvecPage["remote"]> => {
    const ctx = await resolveCharacterActionContext(supabase, params.entityId, null, params.locale);
    if (!ctx) return null;
    const canEdit = await canUserEditEntityById(supabase, { entityId: params.entityId, userId: params.userId });
    const runtimeState = await getOrInitializeRuntimeState(supabase, ctx, { persist: canEdit });
    return { sheet: ctx.sheet, hitDiceTotals: ctx.hitDiceTotals, runtimeState };
  })();

  const rulesetPromise = selectionHasAnything(selection)
    ? buildResolvedRulesetView(supabase, params.worldId, selectionBody(selection), params.locale).then((vue) => ({
        cleSelection: selectionKey(selection),
        vue,
      }))
    : Promise.resolve(null);

  const [remote, ruleset] = await Promise.all([remotePromise, rulesetPromise]);
  return { remote, ruleset };
}

/**
 * Lance `chargerFicheAvecPage` pour une page qui affiche une entite, SANS
 * l'attendre : la promesse part avec la page (ADR 0056). `null` sans
 * appelant connecte ou sans bloc `character`.
 */
export function lancerFicheAvecPage(
  supabase: TypedClient,
  params: {
    worldId: string;
    entityId: string;
    userId: string | null;
    locale: Locale;
    blocks: readonly { blockType: string; data: unknown }[];
  }
): Promise<FicheAvecPage> | null {
  const character = params.blocks.find((b) => b.blockType === "character");
  if (!params.userId || !character) return null;
  return chargerFicheAvecPage(supabase, {
    worldId: params.worldId,
    entityId: params.entityId,
    userId: params.userId,
    locale: params.locale,
    character: character.data as CharacterBlockData,
    inventory: params.blocks.find((b) => b.blockType === "inventory")?.data as InventoryBlockData | undefined,
    spellcasting: params.blocks.find((b) => b.blockType === "spellcasting")?.data as SpellcastingBlockData | undefined,
  });
}
