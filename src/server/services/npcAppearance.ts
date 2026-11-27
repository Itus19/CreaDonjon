import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { APPEARANCE_LABEL, HIDDEN_LABEL, blockLabel, type NpcPortraitInput } from "@/src/core/ai/npcPortrait";
import { excerptFromSegments } from "@/src/core/richtext/excerpt";
import { zTextBlockData, type TextBlockData } from "@/src/core/schemas/blocks/text";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { presentsIci } from "@/src/core/rules/scenePresence";
import type { AiProvider } from "@/src/server/ai/provider";
import { draftNpcPortrait } from "@/src/server/ai/npcPortrait";
import { listBlocksByTypesForEntities, listBlocksForEntity, type BlockRow } from "@/src/server/repos/blocks";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { getEntityById } from "@/src/server/repos/entities";
import { insertAiProposal } from "@/src/server/repos/aiProposals";
import { createBlockWithData, reorderBlock } from "@/src/server/services/blocks";
import { nameInventoryItems } from "@/src/server/services/facetDiscoveries";
import { isWorldAdmin } from "@/src/server/services/permissions";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/** Un bloc texte d'un seul paragraphe, de la visibilité du bloc. */
function oneParagraph(text: string, level: "public" | "gm"): TextBlockData {
  return zTextBlockData.parse({
    __v: 1,
    segments: [{ id: crypto.randomUUID(), blockType: "paragraph", visibility: { level, scopeId: null }, content: [{ t: "text", v: text }], align: "left" }],
  });
}

/** Ce que la description dit de visible : jamais un paragraphe réservé au MJ, qui fuirait dans le portrait. */
function visibleDescription(blocks: readonly BlockRow[]): string | undefined {
  const text = blocks.find((b) => b.block_type === "text" && blockLabel(b) !== APPEARANCE_LABEL && blockLabel(b) !== HIDDEN_LABEL);
  const parsed = text ? zTextBlockData.safeParse(text.data) : null;
  if (!parsed?.success) return undefined;
  const visible = parsed.data.segments.filter((s) => s.visibility.level === "public" || s.visibility.level === "players");
  return excerptFromSegments(visible) ?? undefined;
}

export type EnsureNpcAppearanceOutcome = { ok: true; created: boolean } | { ok: false; reason: string };

/**
 * V3.2-54 (retour de l'auteur, 27 novembre) — Donne à un PNJ son bloc
 * « Apparence » : un portrait riche, rédigé par l'IA d'après ce que le moteur
 * a déjà fixé (libellé, description visible, objets portés) et ce que la
 * narration du tour a montré de lui. Il se place en tête de la fiche, lisible
 * de qui voit la fiche. Un détail caché proposé par l'IA part dans un bloc
 * « Ce qui ne se voit pas », réservé au MJ.
 *
 * Règle 9 : l'écriture est tracée par une ligne `ai_proposals`
 * (`create_block`, appliquée d'office comme une note du monde, ADR 0114) ;
 * la personne qui joue la corrige ou la retire dans le wiki.
 *
 * Coût : une lecture des blocs de la fiche, un appel d'IA, une résolution des
 * noms d'objets, deux créations de bloc au plus. Une fois par PNJ.
 */
export async function ensureNpcAppearance(
  supabase: TypedClient,
  provider: AiProvider,
  params: { world: { id: string; slug: string }; campaignId: string; sessionEventId: string | null; entityId: string; callerId: string; locale: Locale; narration?: string; place?: string }
): Promise<EnsureNpcAppearanceOutcome> {
  const blocks = await listBlocksForEntity(supabase, params.entityId);
  if (blocks.some((b) => b.block_type === "text" && blockLabel(b) === APPEARANCE_LABEL)) return { ok: true, created: false };
  const entity = await getEntityById(supabase, params.entityId);
  if (!entity) return { ok: false, reason: "not_found" };

  const inventory = blocks.find((b) => b.block_type === "inventory");
  const gear = inventory ? zInventoryBlockData.safeParse(inventory.data) : null;
  const wornItems = gear?.success ? gear.data.items.filter((i) => i.equipped === true && i.concealed !== true) : [];
  const worn = (await nameInventoryItems(supabase, { world: params.world, locale: params.locale, items: wornItems })).map((i) => i.name);
  const description = visibleDescription(blocks);

  const input: NpcPortraitInput = {
    label: entity.name,
    worn,
    ...(description ? { description } : {}),
    ...(params.place ? { place: params.place } : {}),
    ...(params.narration ? { narration: params.narration } : {}),
  };
  const drafted = await draftNpcPortrait(supabase, provider, { userId: params.callerId, campaignId: params.campaignId, input });
  if (!drafted.ok) return { ok: false, reason: drafted.reason };

  const created = await createBlockWithData(supabase, {
    entityId: params.entityId,
    blockType: "text",
    label: APPEARANCE_LABEL,
    visibilityLevel: "public",
    visibilityScopeId: null,
    createdBy: params.callerId,
    data: oneParagraph(drafted.portrait.apparence, "public"),
  });
  if (!created.ok) return { ok: false, reason: "forbidden" };
  await putFirst(supabase, { entityId: params.entityId, before: blocks, changedBy: params.callerId });

  if (drafted.portrait.cache) {
    const hidden = await createBlockWithData(supabase, {
      entityId: params.entityId,
      blockType: "text",
      label: HIDDEN_LABEL,
      visibilityLevel: "gm",
      visibilityScopeId: null,
      createdBy: params.callerId,
      data: oneParagraph(drafted.portrait.cache, "gm"),
    });
    if (!hidden.ok) console.warn(`Détail caché du portrait non écrit pour ${params.entityId}`);
  }

  await insertAiProposal(supabase, {
    worldId: params.world.id,
    campaignId: params.campaignId,
    sessionEventId: params.sessionEventId,
    kind: "create_block",
    targetEntityId: params.entityId,
    payload: { label: APPEARANCE_LABEL, apparence: drafted.portrait.apparence, ...(drafted.portrait.cache ? { cache: drafted.portrait.cache } : {}) } as unknown as Json,
    status: "applied",
    autoApplied: true,
    appliedAt: new Date().toISOString(),
  });
  return { ok: true, created: true };
}

/** Le bloc qui vient d'être créé (le dernier) passe devant tous les autres. */
async function putFirst(supabase: TypedClient, params: { entityId: string; before: readonly BlockRow[]; changedBy: string }): Promise<void> {
  if (params.before.length === 0) return;
  const after = await listBlocksForEntity(supabase, params.entityId);
  const known = new Set(params.before.map((b) => b.id));
  const fresh = after.find((b) => !known.has(b.id));
  if (!fresh) return;
  const first = Math.min(...params.before.map((b) => b.display_order));
  const moved = await reorderBlock(supabase, { id: fresh.id, expectedVersion: fresh.version, displayOrder: first - 1000, changedBy: params.changedBy });
  if (!moved.ok) console.warn(`Bloc Apparence laissé en fin de fiche (${moved.reason})`);
}

/** Un portrait par tour au plus : un appel d'IA de plus après la narration, jamais une rafale. */
const PORTRAITS_PER_TURN = 1;

/**
 * V3.2-54 — Après la narration d'un tour solo : le premier PNJ de la pièce
 * sans bloc « Apparence » reçoit son portrait, nourri de ce que la narration
 * vient de montrer. Les autres attendent les tours suivants.
 *
 * Réservé au MJ du monde (en solo : la personne qui joue). Une fiche de
 * personnage (`character` : un PJ, un PNJ bâti à la main) n'est jamais
 * complétée d'office.
 *
 * Coût : le droit de MJ, une lecture de la scène et une lecture groupée des
 * blocs des présents à chaque tour ; un portrait (`ensureNpcAppearance`)
 * seulement s'il en manque un.
 */
export async function ensureNpcAppearancesForPresents(
  supabase: TypedClient,
  provider: AiProvider,
  params: { world: { id: string; slug: string }; campaignId: string; sessionEventId: string | null; actorEntityId: string; callerId: string; locale: Locale; narration?: string }
): Promise<{ given: string[] }> {
  if (!(await isWorldAdmin(supabase, { worldId: params.world.id, userId: params.callerId }))) return { given: [] };
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene) return { given: [] };
  const ids = [...new Set(presentsIci(scene).map((p) => p.entityId))].filter((id) => id !== params.actorEntityId);
  if (ids.length === 0) return { given: [] };

  const blocks = await listBlocksByTypesForEntities(supabase, ids, ["text", "character"]);
  const lacking = ids.filter(
    (id) =>
      !blocks.some((b) => b.entity_id === id && b.block_type === "character") &&
      !blocks.some((b) => b.entity_id === id && b.block_type === "text" && blockLabel(b) === APPEARANCE_LABEL)
  );

  const given: string[] = [];
  for (const entityId of lacking.slice(0, PORTRAITS_PER_TURN)) {
    const outcome = await ensureNpcAppearance(supabase, provider, {
      world: params.world,
      campaignId: params.campaignId,
      sessionEventId: params.sessionEventId,
      entityId,
      callerId: params.callerId,
      locale: params.locale,
      ...(params.narration ? { narration: params.narration } : {}),
    });
    if (outcome.ok && outcome.created) given.push(entityId);
    else if (!outcome.ok) console.warn(`Pas de portrait pour ${entityId} (${outcome.reason})`);
  }
  return { given };
}
