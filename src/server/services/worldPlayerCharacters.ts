import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import { getEntityById } from "@/src/server/repos/entities";
import { listBlocksForEntity } from "@/src/server/repos/blocks";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { listCampaigns } from "@/src/server/services/campaigns";
import { assembleResolvedRuleset } from "@/src/server/services/resolvedRuleset";

type TypedClient = SupabaseClient<Database>;

export interface WorldPlayerCharacter {
  entityId: string;
  entitySlug: string;
  entityName: string;
  speciesLabel: string | null;
  classesLabel: string | null;
  /** Compte qui a reclame ce PJ (`campaign_characters.user_id`) — `null` si pas encore reclame. Le nom d'affichage est resolu par l'appelant (`listWorldCards`), jamais ici. */
  claimedByUserId: string | null;
}

/**
 * PJ (au sens de `campaign_characters.is_pc`, jamais un `entity_kind`
 * distinct — specs/arbitrage-modifications.md §3.1) de toutes les
 * campagnes d'un monde, pour la liste de l'ecran d'accueil (V1-C4). Chaque
 * personnage est resolu avec le ruleset de SA campagne (des campagnes
 * differentes du meme monde peuvent epingler des variantes differentes).
 */
export async function listWorldPlayerCharacters(
  supabase: TypedClient,
  worldId: string,
  locale: Locale
): Promise<WorldPlayerCharacter[]> {
  const campaigns = await listCampaigns(supabase, worldId);
  const results: WorldPlayerCharacter[] = [];

  for (const campaign of campaigns) {
    const characters = await listCampaignCharacters(supabase, campaign.id);
    for (const row of characters) {
      if (!row.is_pc) continue;

      const entity = await getEntityById(supabase, row.entity_id);
      if (!entity) continue;

      const blocks = await listBlocksForEntity(supabase, row.entity_id);
      const characterBlock = blocks.find((b) => b.block_type === "character");
      const characterData = characterBlock?.data as CharacterBlockData | undefined;

      let speciesLabel: string | null = null;
      let classesLabel: string | null = null;
      if (characterData) {
        const speciesKey = characterData.species?.kind === "rule" ? characterData.species.key : undefined;
        const classSelections = characterData.classes
          .filter((c) => c.class.kind === "rule" && c.class.key)
          .map((c) => ({ key: (c.class as { kind: "rule"; key: string }).key, level: c.level }));

        const assembled = await assembleResolvedRuleset(
          supabase,
          campaign.rulesetId,
          { species: speciesKey, classes: classSelections },
          locale
        );
        speciesLabel = speciesKey ? (assembled.ruleset.features[`species:${speciesKey}`]?.label ?? speciesKey) : null;
        classesLabel =
          classSelections.length > 0
            ? classSelections.map((c) => `${assembled.ruleset.classes[c.key]?.label ?? c.key} ${c.level}`).join(" / ")
            : null;
      }

      results.push({
        entityId: entity.id,
        entitySlug: entity.slug,
        entityName: entity.name,
        speciesLabel,
        classesLabel,
        claimedByUserId: row.user_id,
      });
    }
  }

  return results;
}

/**
 * Version legere de `listWorldPlayerCharacters` ci-dessus : aucune
 * resolution de ruleset (especes/classes), juste l'ensemble des entites
 * marquees PJ (`campaign_characters.is_pc`) — pour scinder le groupe
 * "Personnages" du sommaire en PJ/PNJ (V2-G7, `buildEntityTree`). PJ/PNJ
 * n'est jamais un `entity_kind` distinct (specs/arbitrage-modifications.md
 * §3.1) : ce Set n'est utilise qu'au moment de construire le sommaire,
 * jamais ecrit nulle part.
 */
export async function listPlayerCharacterEntityIds(supabase: TypedClient, worldId: string): Promise<Set<string>> {
  const campaigns = await listCampaigns(supabase, worldId);
  const ids = new Set<string>();
  for (const campaign of campaigns) {
    const characters = await listCampaignCharacters(supabase, campaign.id);
    for (const row of characters) {
      if (row.is_pc) ids.add(row.entity_id);
    }
  }
  return ids;
}
