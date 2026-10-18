import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { listCampaigns } from "@/src/server/services/campaignSummary";
import { resolveEntryNames } from "@/src/server/services/resolvedRuleset";

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

  const identites = await libellesIdentite(
    supabase,
    pcRows.map(({ campaign, row }) => ({ entityId: row.entity_id, rulesetId: campaign.rulesetId, character: characterDataByEntityId.get(row.entity_id) })),
    locale
  );

  const results = pcRows.map(({ row }): WorldPlayerCharacter | null => {
    const entity = entityById.get(row.entity_id);
    if (!entity) return null;
    const identite = identites.get(row.entity_id);
    return {
      entityId: entity.id,
      entitySlug: entity.slug,
      entityName: entity.name,
      speciesLabel: identite?.speciesLabel ?? null,
      classesLabel: identite?.classesLabel ?? null,
      claimedByUserId: row.user_id,
    };
  });

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

/** Ce qu'une carte ou une ligne montre d'un personnage : espèce, classes avec leur niveau, niveau total. */
export interface IdentitePersonnage {
  speciesLabel: string | null;
  /** « Rôdeuse 3 », « Guerrier 2 / Magicien 1 ». */
  classesLabel: string | null;
  /** Somme des niveaux de classe, au moins 1. */
  level: number;
}

/**
 * Les libellés d'identité de plusieurs personnages (V3.1-62, C4 ; partagé
 * par V3.1-82). Seuls les NOMS de l'espèce et des classes s'affichent : une
 * lecture de noms par ruleset (toutes les clés de tous ses PJ ensemble) au
 * lieu d'un assemblage complet par PJ — mêmes noms, lus par la même fonction
 * que l'assembleur. Un personnage sans bloc `character` n'a pas d'entrée.
 */
export async function libellesIdentite(
  supabase: TypedClient,
  items: readonly { entityId: string; rulesetId: string; character: CharacterBlockData | undefined }[],
  locale: Locale
): Promise<Map<string, IdentitePersonnage>> {
  const selections = items
    .filter((item): item is { entityId: string; rulesetId: string; character: CharacterBlockData } => item.character !== undefined)
    .map(({ entityId, rulesetId, character }) => ({
      entityId,
      rulesetId,
      speciesKey: character.species?.kind === "rule" ? character.species.key : undefined,
      classSelections: (character.classes ?? [])
        .filter((c) => c.class.kind === "rule" && c.class.key)
        .map((c) => ({ key: (c.class as { kind: "rule"; key: string }).key, level: c.level })),
      level: Math.max(1, (character.classes ?? []).reduce((sum, c) => sum + c.level, 0)),
    }));
  const keysByRuleset = new Map<string, Set<string>>();
  for (const sel of selections) {
    const keys = keysByRuleset.get(sel.rulesetId) ?? new Set<string>();
    if (sel.speciesKey) keys.add(sel.speciesKey);
    for (const c of sel.classSelections) keys.add(c.key);
    keysByRuleset.set(sel.rulesetId, keys);
  }
  const namesByRuleset = new Map(
    await Promise.all(
      [...keysByRuleset.entries()].map(
        async ([rulesetId, keys]) => [rulesetId, await resolveEntryNames(supabase, rulesetId, [...keys], locale)] as const
      )
    )
  );
  return new Map(
    selections.map(({ entityId, rulesetId, speciesKey, classSelections, level }) => {
      const names = namesByRuleset.get(rulesetId) ?? new Map<string, string>();
      return [
        entityId,
        {
          speciesLabel: speciesKey ? (names.get(speciesKey) ?? speciesKey) : null,
          classesLabel: classSelections.length > 0 ? classSelections.map((c) => `${names.get(c.key) ?? c.key} ${c.level}`).join(" / ") : null,
          level,
        },
      ] as const;
    })
  );
}
