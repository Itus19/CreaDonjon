import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { validateBlockData, type BlockType } from "@/src/core/schemas/blocks/registry";
import { remapEntityIds } from "@/src/core/linker/remapEntityIds";
import { WORLD_EXPORT_FORMAT_VERSION, type WorldExport } from "@/src/core/schemas/worldExport";
import {
  getOfficialBaseRulesetId,
  insertRulesetVariant,
  upsertRulesetOverride,
} from "@/src/server/repos/rules";
import {
  getRulesetInfoForExport,
  getSingleCampaignMode,
  getWorldForExport,
  insertImportedBlocks,
  insertImportedMechanicalRevisions,
  insertImportedRelations,
  insertImportedWorld,
  listAllOverridesForRuleset,
  listBlocksForEntities,
  listEntitiesForWorld,
  listMechanicalRevisionsForEntities,
  listRelationsForWorld,
  setEntityCurrentRevision,
} from "@/src/server/repos/worldExport";
import { createCampaign, type CampaignSummary } from "@/src/server/services/campaigns";
import { createEntity } from "@/src/server/services/entities";
import { generateUniqueSlug } from "@/src/server/services/worlds";
import { getWorldById, type WorldSummary } from "@/src/server/repos/worlds";

type TypedClient = SupabaseClient<Database>;

const DOWNGRADED_VISIBILITY = "gm" as const;

/** `campaign`/`user` ne survivent a aucun export : leur scopeId (id de campagne ou d'utilisateur) n'existe nulle part ailleurs qu'ici. Repli le plus sur (jamais moins visible qu'avant) plutot qu'un rejet — voir specs/ruleset-personnel.md pour la meme logique appliquee au ruleset personnel. */
function downgradeVisibility(level: string): string {
  return level === "campaign" || level === "user" ? DOWNGRADED_VISIBILITY : level;
}

export interface ExportWorldResult {
  data: WorldExport;
  warnings: string[];
}

export async function exportWorld(supabase: TypedClient, worldId: string): Promise<ExportWorldResult> {
  const world = await getWorldForExport(supabase, worldId);
  if (!world) throw new Error("Monde introuvable.");
  if (!world.defaultRulesetId) {
    throw new Error("Ce monde n'a pas de ruleset actif — impossible a exporter.");
  }

  const rulesetInfo = await getRulesetInfoForExport(supabase, world.defaultRulesetId);
  if (!rulesetInfo) throw new Error("Ruleset introuvable pour ce monde.");

  const warnings: string[] = [];

  let ruleset: WorldExport["ruleset"];
  if (rulesetInfo.isOfficialBase) {
    ruleset = { kind: "official", baseSystem: rulesetInfo.baseSystem as "dnd_srd_51" | "dnd_srd_52" | "custom" };
  } else if (rulesetInfo.contentOrigin === "personal_reference") {
    warnings.push("Ce monde utilise un ruleset personnel : son contenu n'est pas inclus, il faudra le ressaisir apres import.");
    ruleset = {
      kind: "personal_omitted",
      name: rulesetInfo.name,
      baseSystem: rulesetInfo.baseSystem as "dnd_srd_51" | "dnd_srd_52" | "custom",
      note: "Ce monde utilise un ruleset personnel non inclus.",
    };
  } else {
    const overrides = await listAllOverridesForRuleset(supabase, rulesetInfo.id);
    ruleset = {
      kind: "variant",
      name: rulesetInfo.name,
      baseSystem: rulesetInfo.baseSystem as "dnd_srd_51" | "dnd_srd_52" | "custom",
      overrides: overrides.map((o) => ({
        entryKey: o.entry_key,
        blockType: o.block_type,
        action: o.action as never,
        payload: o.payload,
        patch: o.patch,
        note: o.note,
      })),
    };
  }

  const suggestedMode = await getSingleCampaignMode(supabase, worldId);

  const entities = await listEntitiesForWorld(supabase, worldId);
  const entityIds = entities.map((e) => e.id);
  const blocks = await listBlocksForEntities(supabase, entityIds);
  const relations = await listRelationsForWorld(supabase, worldId);
  const mechanicalRevisions = await listMechanicalRevisionsForEntities(supabase, entityIds);

  const revisionIdToNumber = new Map(mechanicalRevisions.map((r) => [r.id, r.revision_number]));

  let downgradedCount = 0;
  const countDowngrade = (level: string): string => {
    const next = downgradeVisibility(level);
    if (next !== level) downgradedCount += 1;
    return next;
  };

  const data: WorldExport = {
    formatVersion: WORLD_EXPORT_FORMAT_VERSION,
    world: { name: world.name, calendar: world.calendar },
    ruleset,
    suggestedMode,
    entities: entities.map((e) => ({
      ref: e.id,
      entityKind: e.entity_kind,
      name: e.name,
      aliases: e.aliases,
      currentRevisionNumber: e.current_mechanical_revision_id
        ? (revisionIdToNumber.get(e.current_mechanical_revision_id) ?? null)
        : null,
    })),
    blocks: blocks.map((b) => ({
      entityRef: b.entity_id,
      blockType: b.block_type as BlockType,
      display: b.display,
      data: b.data,
      displayOrder: b.display_order,
      visibilityLevel: countDowngrade(b.visibility_level) as never,
    })),
    relations: relations.map((r) => ({
      sourceRef: r.source_entity_id,
      targetRef: r.target_entity_id,
      relationType: r.relation_type as never,
      visibilityLevel: countDowngrade(r.visibility_level) as never,
    })),
    mechanicalRevisions: mechanicalRevisions.map((r) => ({
      entityRef: r.entity_id,
      revisionNumber: r.revision_number,
      mechanicalData: r.mechanical_data,
      changeNote: r.change_note,
    })),
  };

  if (downgradedCount > 0) {
    warnings.push(
      `${downgradedCount} bloc(s)/relation(s) a visibilite restreinte a une campagne ou un utilisateur precis ont ete ramenes a "MJ" (leur portee d'origine ne peut pas survivre a un export).`
    );
  }

  return { data, warnings };
}

export interface ImportWorldParams {
  ownerId: string;
  mode: "campaign" | "solo";
  data: WorldExport;
}

export interface ImportWorldResult {
  world: WorldSummary;
  campaign: CampaignSummary;
}

/**
 * Reconstruit un monde complet depuis un export (V2-G1, dernier point du
 * ticket) : nouveau monde, nouvelle campagne unique (mode choisi par
 * l'appelant — jamais impose par le fichier), entites/blocs/relations/
 * revisions mecaniques rejoues avec de nouveaux ids (jamais les ids
 * d'origine, pour eviter toute collision avec une base existante).
 * `remapEntityIds` reecrit les references d'entite embarquees DANS le JSON
 * de chaque bloc/revision (ex. un objet d'inventaire qui pointe vers une
 * autre entite) — les colonnes SQL (`relations.source_entity_id`, etc.) sont
 * remappees directement ici.
 */
export async function importWorld(supabase: TypedClient, params: ImportWorldParams): Promise<ImportWorldResult> {
  const { ownerId, data } = params;

  const rulesetId = await resolveImportedRuleset(supabase, ownerId, data.ruleset);

  const slug = await generateUniqueSlug(supabase, ownerId, data.world.name);
  const insertedWorld = await insertImportedWorld(supabase, {
    ownerId,
    name: data.world.name,
    slug,
    calendar: data.world.calendar as Json,
  });

  const campaign = await createCampaign(supabase, {
    worldId: insertedWorld.id,
    createdBy: ownerId,
    name: data.world.name,
    rulesetId,
    mode: params.mode,
  });
  if (campaign === "world_already_has_campaign") {
    throw new Error("Le monde importe possede deja une campagne : incoherence interne.");
  }

  const idMap = new Map<string, string>();
  for (const entity of data.entities) {
    const inserted = await createEntity(supabase, {
      worldId: insertedWorld.id,
      createdBy: ownerId,
      entityKind: entity.entityKind,
      name: entity.name,
      aliases: entity.aliases,
    });
    idMap.set(entity.ref, inserted.id);
  }

  const blockInputs = data.blocks.map((b) => {
    const entityId = idMap.get(b.entityRef);
    if (!entityId) throw new Error(`Bloc reference une entite inconnue (${b.entityRef}) : fichier corrompu.`);
    const remappedData = remapEntityIds(b.data, idMap) as Json;
    validateBlockData(b.blockType, remappedData);
    return {
      entityId,
      blockType: b.blockType,
      display: b.display as Json,
      data: remappedData,
      displayOrder: b.displayOrder,
      visibilityLevel: b.visibilityLevel,
      createdBy: ownerId,
    };
  });
  await insertImportedBlocks(supabase, blockInputs);

  const relationInputs = data.relations.map((r) => {
    const sourceEntityId = idMap.get(r.sourceRef);
    const targetEntityId = idMap.get(r.targetRef);
    if (!sourceEntityId || !targetEntityId) {
      throw new Error("Relation reference une entite inconnue : fichier corrompu.");
    }
    return {
      worldId: insertedWorld.id,
      sourceEntityId,
      targetEntityId,
      relationType: r.relationType,
      visibilityLevel: r.visibilityLevel,
      createdBy: ownerId,
    };
  });
  await insertImportedRelations(supabase, relationInputs);

  if (data.mechanicalRevisions.length > 0) {
    const revisionInputs = data.mechanicalRevisions.map((r) => {
      const entityId = idMap.get(r.entityRef);
      if (!entityId) throw new Error(`Revision mecanique reference une entite inconnue (${r.entityRef}) : fichier corrompu.`);
      return {
        entityId,
        revisionNumber: r.revisionNumber,
        mechanicalData: remapEntityIds(r.mechanicalData, idMap) as Json,
        changeNote: r.changeNote,
        createdBy: ownerId,
      };
    });
    const insertedRevisions = await insertImportedMechanicalRevisions(supabase, revisionInputs);
    const revisionIdByEntityAndNumber = new Map(insertedRevisions.map((r) => [`${r.entity_id}:${r.revision_number}`, r.id]));

    for (const entity of data.entities) {
      if (entity.currentRevisionNumber === null) continue;
      const entityId = idMap.get(entity.ref)!;
      const revisionId = revisionIdByEntityAndNumber.get(`${entityId}:${entity.currentRevisionNumber}`);
      if (revisionId) await setEntityCurrentRevision(supabase, entityId, revisionId);
    }
  }

  const world = await getWorldById(supabase, insertedWorld.id);
  if (!world) throw new Error("Monde importe introuvable juste apres sa creation : incoherence interne.");

  return { world, campaign };
}

async function resolveImportedRuleset(supabase: TypedClient, ownerId: string, ruleset: WorldExport["ruleset"]): Promise<string> {
  if (ruleset.kind === "official" || ruleset.kind === "personal_omitted") {
    const officialId = await getOfficialBaseRulesetId(supabase, ruleset.baseSystem);
    if (!officialId) {
      throw new Error(`Aucun ruleset officiel "${ruleset.baseSystem}" en base — lancer l'import SRD avant d'importer ce monde.`);
    }
    return officialId;
  }

  const officialId = await getOfficialBaseRulesetId(supabase, ruleset.baseSystem);
  if (!officialId) {
    throw new Error(`Aucun ruleset officiel "${ruleset.baseSystem}" en base — lancer l'import SRD avant d'importer ce monde.`);
  }
  const variant = await insertRulesetVariant(supabase, {
    name: ruleset.name,
    baseSystem: ruleset.baseSystem,
    parentRulesetId: officialId,
    createdBy: ownerId,
    contentOrigin: "user_created",
  });
  for (const override of ruleset.overrides) {
    await upsertRulesetOverride(supabase, {
      rulesetId: variant.id,
      entryKey: override.entryKey,
      blockType: override.blockType,
      action: override.action,
      payload: override.payload as Json,
      patch: override.patch as Json,
      note: override.note,
    });
  }
  return variant.id;
}

/** Dupliquer = exporter puis reimporter pour le meme proprietaire, sans jamais serialiser le JSON intermediaire vers le client (une seule requete, V2-G1). */
export async function duplicateWorld(supabase: TypedClient, params: { worldId: string; ownerId: string }): Promise<ImportWorldResult> {
  const { data } = await exportWorld(supabase, params.worldId);
  const renamed: WorldExport = { ...data, world: { ...data.world, name: `${data.world.name} (copie)` } };
  return importWorld(supabase, {
    ownerId: params.ownerId,
    mode: data.suggestedMode ?? "campaign",
    data: renamed,
  });
}
