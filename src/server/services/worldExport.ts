import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { validateBlockData, type BlockType } from "@/src/core/schemas/blocks/registry";
import { remapEntityIds } from "@/src/core/linker/remapEntityIds";
import { remapAssetIds } from "@/src/core/images/remapAssetIds";
import { WORLD_EXPORT_FORMAT_VERSION, type WorldExport } from "@/src/core/schemas/worldExport";
import {
  getOfficialBaseRulesetId,
  insertRulesetVariant,
  upsertRulesetOverride,
} from "@/src/server/repos/rules";
import {
  getRulesetInfoForExport,
  insertBlockImages,
  insertEntityAssets,
  listAssetsForWorld,
  listBlockImagesForBlocks,
  listEntityAssetsForEntities,
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
import { copyAssetToWorld } from "@/src/server/services/storage";

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
  const { data, warnings } = await lireMonde(supabase, worldId);
  return { data, warnings };
}

/**
 * L'export, plus ce que seule la duplication utilise et qui ne part jamais
 * dans un fichier (V3-F3) : les identifiants d'origine des blocs (dans
 * l'ordre de `data.blocks`) et le ruleset du monde.
 */
interface MondeLu extends ExportWorldResult {
  sourceBlockIds: string[];
  sourceRulesetId: string;
}

async function lireMonde(supabase: TypedClient, worldId: string): Promise<MondeLu> {
  const world = await getWorldForExport(supabase, worldId);
  if (!world) throw new Error("Monde introuvable.");
  if (!world.defaultRulesetId) {
    throw new Error("Ce monde n'a pas de ruleset actif — impossible à exporter.");
  }

  const rulesetInfo = await getRulesetInfoForExport(supabase, world.defaultRulesetId);
  if (!rulesetInfo) throw new Error("Ruleset introuvable pour ce monde.");

  const warnings: string[] = [];

  let ruleset: WorldExport["ruleset"];
  if (rulesetInfo.isOfficialBase) {
    ruleset = { kind: "official", baseSystem: rulesetInfo.baseSystem as "dnd_srd_51" | "dnd_srd_52" | "custom" };
  } else if (rulesetInfo.contentOrigin === "personal_reference") {
    warnings.push("Ce monde utilise un ruleset personnel : son contenu n'est pas inclus, il faudra le ressaisir après import.");
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

  return { data, warnings, sourceBlockIds: blocks.map((b) => b.id), sourceRulesetId: world.defaultRulesetId };
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
  const { world, campaign } = await importerMonde(supabase, params);
  return { world, campaign };
}

/** Ce que seule la duplication ajoute a un import (V3-F3, ADR 0058). */
interface OptionsDeCopie {
  /** Reprendre ce ruleset tel quel (ruleset personnel du meme proprietaire), au lieu de le resoudre depuis l'export. */
  rulesetId?: string;
  /** Appele des que le monde neuf existe, avant ses blocs : copie les images et rend « ancien id -> nouvel id ». */
  copierImages?: (nouveauMondeId: string) => Promise<Map<string, string>>;
}

interface MondeImporte extends ImportWorldResult {
  entityIdMap: Map<string, string>;
  /** Identifiants des blocs crees, dans l'ordre de `data.blocks`. */
  blockIds: string[];
  assetIdMap: Map<string, string>;
}

async function importerMonde(supabase: TypedClient, params: ImportWorldParams & OptionsDeCopie): Promise<MondeImporte> {
  const { ownerId, data } = params;

  const rulesetId = params.rulesetId ?? (await resolveImportedRuleset(supabase, ownerId, data.ruleset));

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
    throw new Error("Le monde importé possède déjà une campagne : incohérence interne.");
  }

  const assetIdMap = params.copierImages ? await params.copierImages(insertedWorld.id) : new Map<string, string>();

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
    const remappedData = remapAssetIds(remapEntityIds(b.data, idMap), assetIdMap) as Json;
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
  const blockIds = await insertImportedBlocks(supabase, blockInputs);

  const relationInputs = data.relations.map((r) => {
    const sourceEntityId = idMap.get(r.sourceRef);
    const targetEntityId = idMap.get(r.targetRef);
    if (!sourceEntityId || !targetEntityId) {
      throw new Error("Relation référence une entité inconnue : fichier corrompu.");
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
        mechanicalData: remapAssetIds(remapEntityIds(r.mechanicalData, idMap), assetIdMap) as Json,
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
  if (!world) throw new Error("Monde importé introuvable juste après sa création : incohérence interne.");

  return { world, campaign, entityIdMap: idMap, blockIds, assetIdMap };
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

export interface DuplicateWorldParams {
  worldId: string;
  ownerId: string;
  /** Choisi a chaque duplication (ADR 0058) ; `solo` est verifie superadmin par la route. */
  mode: "campaign" | "solo";
  /** Les regles suivent : variante recopiee, ruleset personnel repris tel quel. Sinon, le ruleset officiel de la meme base. */
  rulesFollow: boolean;
}

/**
 * Dupliquer = copier le wiki d'un monde dans un monde neuf, pour le meme
 * proprietaire (V2-G1, refait par V3-F3, ADR 0058). Le wiki seul : fiches,
 * blocs, relations, revisions mecaniques, et leurs images, copiees dans le
 * monde neuf. Rien de la partie : ni decouvertes, ni scene, ni journal, ni
 * membres, ni personnages attribues. Le JSON intermediaire ne passe jamais
 * par le client (une seule requete).
 */
export async function duplicateWorld(supabase: TypedClient, params: DuplicateWorldParams): Promise<ImportWorldResult> {
  const lu = await lireMonde(supabase, params.worldId);
  let data: WorldExport = { ...lu.data, world: { ...lu.data.world, name: `${lu.data.world.name} (copie)` } };
  let rulesetId: string | undefined;
  if (!params.rulesFollow) {
    data = { ...data, ruleset: { kind: "official", baseSystem: data.ruleset.baseSystem } };
  } else if (data.ruleset.kind === "personal_omitted") {
    rulesetId = lu.sourceRulesetId; // meme proprietaire : son ruleset personnel le suit tel quel
  }

  // Les images que le wiki designe : liens (portraits, blocs Image) et
  // identifiants pris dans les donnees des blocs et des revisions (cartes,
  // portrait du bloc personnage, adresses). Une image que rien ne designe
  // n'est pas copiee.
  const sourceEntityIds = lu.data.entities.map((e) => e.ref);
  const [assets, portraits, imagesDeBlocs] = await Promise.all([
    listAssetsForWorld(supabase, params.worldId),
    listEntityAssetsForEntities(supabase, sourceEntityIds),
    listBlockImagesForBlocks(supabase, lu.sourceBlockIds),
  ]);
  const texte = JSON.stringify([lu.data.blocks.map((b) => b.data), lu.data.mechanicalRevisions.map((r) => r.mechanicalData)]);
  const lies = new Set([...portraits.map((p) => p.asset_id), ...imagesDeBlocs.map((b) => b.asset_id)]);
  const aCopier = assets.filter((a) => lies.has(a.id) || texte.includes(a.id));

  const copie = await importerMonde(supabase, {
    ownerId: params.ownerId,
    mode: params.mode,
    data,
    rulesetId,
    copierImages: async (nouveauMondeId) => {
      const correspondance = new Map<string, string>();
      for (const asset of aCopier) {
        correspondance.set(asset.id, await copyAssetToWorld(supabase, asset, { worldId: nouveauMondeId, uploadedBy: params.ownerId }));
      }
      return correspondance;
    },
  });

  // Les liens d'image, rattaches aux fiches et aux blocs neufs.
  const blocNeuf = new Map(lu.sourceBlockIds.map((ancien, k) => [ancien, copie.blockIds[k]]));
  await insertEntityAssets(
    supabase,
    portraits.flatMap((p) => {
      const entityId = copie.entityIdMap.get(p.entity_id);
      const assetId = copie.assetIdMap.get(p.asset_id);
      return entityId && assetId ? [{ ...p, entity_id: entityId, asset_id: assetId }] : [];
    })
  );
  await insertBlockImages(
    supabase,
    imagesDeBlocs.flatMap((b) => {
      const blockId = blocNeuf.get(b.block_id);
      const assetId = copie.assetIdMap.get(b.asset_id);
      return blockId && assetId ? [{ block_id: blockId, asset_id: assetId, hue: b.hue, chroma: b.chroma, available_modes: b.available_modes }] : [];
    })
  );

  return { world: copie.world, campaign: copie.campaign };
}
