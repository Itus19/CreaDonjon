import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
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
 *
 * Audit de performance (retour utilisateur) : la version precedente
 * enchainait `getEntityById` + `listBlocksForEntity` + `assembleResolvedRuleset`
 * en SERIE pour chaque PJ, sans meme un `Promise.all` — 4-6 PJ sur l'ecran
 * d'accueil d'un monde faisaient facilement 20+ allers-retours sequentiels
 * a chaque visite. Desormais : les entites et les blocs `character` de TOUS
 * les PJ sont recuperes en deux requetes en lot (`listEntitiesByIds`,
 * `listBlocksByTypeForEntities`), et seule la resolution de ruleset —
 * differente par PJ (especes/classes) — reste un appel par personnage, mais
 * en parallele plutot qu'en serie.
 */
export async function listWorldPlayerCharacters(
  supabase: TypedClient,
  worldId: string,
  locale: Locale
): Promise<WorldPlayerCharacter[]> {
  const campaigns = await listCampaigns(supabase, worldId);
  const perCampaignCharacters = await Promise.all(
    campaigns.map(async (campaign) => ({
      campaign,
      characters: (await listCampaignCharacters(supabase, campaign.id)).filter((row) => row.is_pc),
    }))
  );
  const pcRows = perCampaignCharacters.flatMap(({ campaign, characters }) =>
    characters.map((row) => ({ campaign, row }))
  );
  if (pcRows.length === 0) return [];

  const entityIds = pcRows.map(({ row }) => row.entity_id);
  const [entities, characterBlocks] = await Promise.all([
    listEntitiesByIds(supabase, entityIds),
    listBlocksByTypeForEntities(supabase, entityIds, "character"),
  ]);
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const characterDataByEntityId = new Map(characterBlocks.map((b) => [b.entity_id, b.data as CharacterBlockData]));

  const results = await Promise.all(
    pcRows.map(async ({ campaign, row }): Promise<WorldPlayerCharacter | null> => {
      const entity = entityById.get(row.entity_id);
      if (!entity) return null;

      const characterData = characterDataByEntityId.get(row.entity_id);
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

      return {
        entityId: entity.id,
        entitySlug: entity.slug,
        entityName: entity.name,
        speciesLabel,
        classesLabel,
        claimedByUserId: row.user_id,
      };
    })
  );

  return results.filter((r): r is WorldPlayerCharacter => r !== null);
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
