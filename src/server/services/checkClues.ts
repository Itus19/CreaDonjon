import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/src/types/database";
import { ABILITY_LABELS, SKILL_ABILITIES, type Ability, type Skill } from "@/src/core/rules/abilities";
import { facetsRevealedByCheck, type RevealCheck } from "@/src/core/rules/facetReveal";
import { playerViewOfInventory, playerViewOfStatblock } from "@/src/core/rules/facets";
import { presentsIci } from "@/src/core/rules/scenePresence";
import { zStatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { concealedMarks, markFacet } from "@/src/core/rules/concealedMarks";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { listFacetDiscoveries } from "@/src/server/repos/entityFacetDiscoveries";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { getCombatById, getCombatParticipantById } from "@/src/server/repos/combats";
import { nameInventoryItems, revealFacets } from "@/src/server/services/facetDiscoveries";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { formatCpFr } from "@/src/i18n/fr";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/** Ce qu'il faut lire d'un tour joué : un jet de compétence ou de caractéristique, son verdict, sa cible. */
const zCheckTurn = z.object({
  intent: z.object({
    kind: z.enum(["skill_check", "ability_check"]),
    action_id: z.string(),
    target_id: z.string().nullable().optional(),
  }),
  check: z.object({ total: z.number(), dc: z.number().nullable(), verdict: z.enum(["success", "fail"]).nullable() }),
});

function checkOf(kind: "skill_check" | "ability_check", actionId: string): RevealCheck | null {
  if (kind === "skill_check") return actionId in SKILL_ABILITIES ? { kind: "skill", key: actionId as Skill } : null;
  return (["str", "dex", "con", "int", "wis", "cha"] as const).includes(actionId as Ability) ? { kind: "ability", key: actionId as Ability } : null;
}

/** V3.2-86 — L'entité d'un participant de combat de cette partie, ou `null` (créature anonyme, autre partie). Deux lectures. */
async function entityOfParticipant(supabase: TypedClient, participantId: string, campaignId: string): Promise<string | null> {
  const participant = await getCombatParticipantById(supabase, participantId);
  if (!participant?.entity_id) return null;
  const combat = await getCombatById(supabase, participant.combat_id);
  return combat?.campaign_id === campaignId ? participant.entity_id : null;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

/**
 * V3.2-50 (ADR 0118 §5) — Après un jet réussi qui vise un PNJ (« j'observe
 * Mabelle »), le moteur choisit ce qu'il fait découvrir (`facetsRevealedByCheck`),
 * l'écrit pour la personne qui a lancé (`entity_facet_discoveries`, lié au tour),
 * et rend une phrase de fait établi pour la narration : l'IA raconte la
 * découverte, elle ne la choisit pas.
 *
 * Un jet raté, ou réussi sans rien de neuf (un objet caché a son propre DD
 * secret, `conceal_dc`), donnent la même phrase « Rien trouvé » : on ne sait
 * jamais s'il n'y avait rien.
 *
 * La cible : celle du jet (`entity:<id>`) ; sans cible, le seul PNJ de la
 * pièce s'il n'y en a qu'un. En combat (V3.2-86), une cible `participant:<id>`
 * se lit comme l'entité de ce participant, s'il en a une et si son combat est
 * celui de cette partie ; une créature anonyme ne révèle rien.
 *
 * Réservé au MJ du monde (en solo : la personne qui joue), seul à lire les
 * blocs `gm` de la fiche. Coût : rien si le tour n'est pas un jet réussi ;
 * sinon une lecture de la scène au plus, une des blocs et une des facettes du
 * PNJ, une écriture groupée, et la résolution des noms d'objets découverts.
 */
export async function revealCluesFromCheck(
  supabase: TypedClient,
  params: { campaignId: string; world: { id: string; slug: string }; locale: Locale; actorEntityId: string; callerId: string; eventId: string; detail: unknown }
): Promise<{ facts: string[]; revealed: number }> {
  const none = { facts: [], revealed: 0 };
  const parsed = zCheckTurn.safeParse(params.detail);
  if (!parsed.success) return none;
  const { intent, check } = parsed.data;
  if (check.verdict === null || check.dc === null) return none;
  const kind = checkOf(intent.kind, intent.action_id);
  if (!kind) return none;
  if (!(await isWorldAdmin(supabase, { worldId: params.world.id, userId: params.callerId }))) return none;

  let entityId: string | null = intent.target_id?.startsWith("entity:")
    ? intent.target_id.slice("entity:".length)
    : intent.target_id?.startsWith("participant:")
      ? await entityOfParticipant(supabase, intent.target_id.slice("participant:".length), params.campaignId)
      : null;
  if (!entityId && !intent.target_id) {
    const scene = await getSceneState(supabase, params.campaignId);
    const here = scene ? [...new Set(presentsIci(scene).map((p) => p.entityId))].filter((id) => id !== params.actorEntityId) : [];
    if (here.length === 1) entityId = here[0]!;
  }
  if (!entityId || entityId === params.actorEntityId) return none;

  const [blocks, knownByEntity] = await Promise.all([
    listBlocksByTypesForEntities(supabase, [entityId], ["statblock", "inventory", "text"]),
    listFacetDiscoveries(supabase, { campaignId: params.campaignId, entityIds: [entityId], userId: params.callerId }),
  ]);
  const sheetRow = blocks.find((b) => b.block_type === "statblock");
  const gearRow = blocks.find((b) => b.block_type === "inventory");
  const sheet = sheetRow ? zStatblockBlockData.safeParse(sheetRow.data) : null;
  const gear = gearRow ? zInventoryBlockData.safeParse(gearRow.data) : null;
  const sheetData = sheet?.success ? sheet.data : null;
  const gearData = gear?.success ? gear.data : null;
  // V3.2-81 : ses signes distinctifs dissimulés (un tatouage sous la manche), dans ses blocs texte.
  const marks = blocks.filter((b) => b.block_type === "text").flatMap((b) => {
    const lu = zTextBlockData.safeParse(b.data);
    return lu.success ? concealedMarks(lu.data.segments) : [];
  });
  if (!sheetData && !gearData && marks.length === 0) return none;

  const nameOf = async () => (await listEntitiesByIds(supabase, [entityId]))[0]?.name ?? "ce personnage";
  // Retour de l'auteur (27 novembre) : un jet raté et une fouille vide disent la même chose,
  // pour que la personne qui joue ne sache pas s'il n'y avait rien ou si son jet était trop faible.
  const nothingFound = async () => ({
    facts: [`Rien trouvé sur ${await nameOf()} : ne dis pas s'il y avait quelque chose à trouver, et n'invente aucun détail.`],
    revealed: 0,
  });
  if (check.verdict === "fail") return nothingFound();

  const facets = facetsRevealedByCheck({
    check: kind,
    total: check.total,
    dc: check.dc,
    npc: { sheet: sheetData ? { actions: sheetData.actions.length, traits: sheetData.traits.length } : null, gear: gearData, marks },
    known: knownByEntity.get(entityId) ?? new Set<string>(),
  });
  if (facets.length === 0) return nothingFound();
  const { revealed } = await revealFacets(supabase, { campaignId: params.campaignId, entityId, facets, userId: params.callerId, sourceEventId: params.eventId });
  if (revealed.length === 0) return nothingFound();

  // La phrase dit seulement ce qui vient d'être découvert, construite comme la vue joueur.
  const fresh = new Set(revealed);
  const parts: string[] = [];
  if (sheetData) {
    const view = playerViewOfStatblock(sheetData, fresh);
    for (const [ability, score] of Object.entries(view.abilities)) {
      parts.push(`${ABILITY_LABELS[ability as Ability]} ${score} (${signed(Math.floor((score - 10) / 2))})`);
    }
    if (view.ac !== undefined) parts.push(`CA ${view.ac}`);
    if (view.hp !== undefined) parts.push(`${view.hp} PV`);
    for (const action of view.actions) parts.push(`sait se battre : ${action.name}`);
  }
  if (gearData) {
    const view = playerViewOfInventory(gearData, fresh);
    const named = await nameInventoryItems(supabase, {
      world: params.world,
      locale: params.locale,
      items: view.items.map((i) => ({ id: i.id, qty: i.qty, ...("ref" in i ? { ref: i.ref } : { label: i.label }) })),
    });
    for (const item of named) parts.push(`${item.name} (caché)`);
    if (view.currency) {
      const c = view.currency;
      parts.push(`bourse : ${formatCpFr(c.pp * 1000 + c.gp * 100 + c.ep * 50 + c.sp * 10 + c.cp)}`);
    }
  }
  for (const mark of marks) if (fresh.has(markFacet(mark.id))) parts.push(`signe distinctif : ${mark.text}`);
  if (parts.length === 0) return { facts: [], revealed: revealed.length };
  return { facts: [`Indices découverts sur ${await nameOf()} : ${parts.join(", ")}.`], revealed: revealed.length };
}
