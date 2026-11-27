import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getEntityById, updateEntityWithVersionCheck, type EntitySummary } from "@/src/server/repos/entities";
import { deleteTrueName, getTrueName, listBlocksCitingEntity, upsertTrueName } from "@/src/server/repos/entityTrueNames";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { recordEntityRevision } from "@/src/server/services/entityHistory";
import { updateBlockContent } from "@/src/server/services/blocks";
import { planNomTable } from "@/src/core/entities/nomPourLaTable";
import { renommerRefs } from "@/src/core/linker/renommerRefs";
import { nomsDitsDans } from "@/src/core/ai/nomRevele";

type TypedClient = SupabaseClient<Database>;

export type NomPourLaTableResult =
  | {
      ok: true;
      /** La fiche telle que le MJ la voit (vrai nom dans `name`). */
      entity: EntitySummary;
      /** Le nom que voit la table, `null` quand le vrai nom est révélé. */
      tableName: string | null;
      liensRenommes: number;
      /** Liens qu'une écriture concurrente a empêché de renommer : à reprendre à la main. */
      liensEnEchec: number;
    }
  | { ok: false; reason: "not_found" | "forbidden" | "conflict" };

/**
 * AG-12 (ADR 0105) — le MJ remplit, change ou vide le « Nom pour la table ».
 * Le vrai nom part dans `entity_true_names` (MJ seul) AVANT que `entities`
 * ne change : une écriture interrompue laisse au pire le vrai nom en double,
 * jamais perdu. Puis les liens qui affichaient l'ancien nom prennent le
 * nouveau (décision du 24 novembre).
 */
export async function setTableName(
  supabase: TypedClient,
  params: { entityId: string; userId: string; expectedVersion: number; tableName: string | null }
): Promise<NomPourLaTableResult> {
  const existing = await getEntityById(supabase, params.entityId);
  if (!existing) return { ok: false, reason: "not_found" };
  const [admin, secret] = await Promise.all([
    isWorldAdmin(supabase, { worldId: existing.world_id, userId: params.userId }),
    getTrueName(supabase, params.entityId),
  ]);
  if (!admin) return { ok: false, reason: "forbidden" };

  const plan = planNomTable({ name: existing.name, aliases: existing.aliases }, secret, params.tableName);
  const vueMj = (e: EntitySummary, s: typeof secret): EntitySummary => (s ? { ...e, name: s.trueName, aliases: s.trueAliases } : e);
  if (plan.kind === "aucun") {
    return { ok: true, entity: vueMj(existing, secret), tableName: secret ? existing.name : null, liensRenommes: 0, liensEnEchec: 0 };
  }

  if (plan.kind === "activer") await upsertTrueName(supabase, { entityId: existing.id, worldId: existing.world_id, secret: plan.secret });
  const updated = await updateEntityWithVersionCheck(supabase, {
    id: existing.id,
    expectedVersion: params.expectedVersion,
    name: plan.entite.name,
    entityKind: existing.entity_kind,
    aliases: plan.entite.aliases,
    isPublic: existing.is_public,
  });
  if (!updated) {
    if (plan.kind === "activer") await deleteTrueName(supabase, existing.id);
    return { ok: false, reason: "conflict" };
  }
  if (plan.kind === "reveler") await deleteTrueName(supabase, existing.id);
  await recordEntityRevision(supabase, { entity: updated, changeSource: "user", changedBy: params.userId });

  const { renommes, echecs } = await renommerLiens(supabase, { worldId: existing.world_id, entityId: existing.id, anciens: plan.anciens, nouveau: plan.nouveau, userId: params.userId });
  const secretApres = plan.kind === "reveler" ? null : plan.kind === "activer" ? plan.secret : secret;
  return {
    ok: true,
    entity: vueMj(updated, secretApres),
    tableName: plan.kind === "reveler" ? null : updated.name,
    liensRenommes: renommes,
    liensEnEchec: echecs,
  };
}

/** Une lecture (les blocs qui citent la fiche), puis une écriture par bloc à renommer. */
async function renommerLiens(
  supabase: TypedClient,
  params: { worldId: string; entityId: string; anciens: string[]; nouveau: string; userId: string }
): Promise<{ renommes: number; echecs: number }> {
  const blocs = await listBlocksCitingEntity(supabase, params.worldId, params.entityId);
  let renommes = 0;
  let echecs = 0;
  for (const b of blocs) {
    const { data, change } = renommerRefs(b.block_type, b.data, params.entityId, params.anciens, params.nouveau);
    if (!change) continue;
    const r = await updateBlockContent(supabase, {
      id: b.id,
      expectedVersion: b.version,
      display: b.display,
      data,
      visibilityLevel: b.visibility_level,
      visibilityScopeId: b.visibility_scope_id,
      changedBy: params.userId,
    });
    if (r.ok) renommes++;
    else {
      console.error("Lien non renommé (nom pour la table)", b.id, r.reason);
      echecs++;
    }
  }
  return { renommes, echecs };
}

/**
 * V3.2-45 — Une narration a écrit le vrai nom d'un présent que le personnage
 * ne connaissait que par son libellé : il l'a appris, la fiche quitte son nom
 * pour la table (même chemin que le MJ qui vide le champ, liens renommés
 * compris). Une lecture par nom dit, puis `setTableName`. Rend les fiches
 * révélées.
 */
export async function revelerNomsDits(
  supabase: TypedClient,
  params: { texte: string; trueNames: readonly { entityId: string; trueName: string }[]; userId: string }
): Promise<string[]> {
  const reveles: string[] = [];
  for (const entityId of nomsDitsDans(params.texte, params.trueNames)) {
    const entity = await getEntityById(supabase, entityId);
    if (!entity) continue;
    const r = await setTableName(supabase, { entityId, userId: params.userId, expectedVersion: entity.version, tableName: null });
    if (r.ok) reveles.push(entityId);
    else console.warn(`Vrai nom non révélé (${r.reason}) pour ${entityId}`);
  }
  return reveles;
}
