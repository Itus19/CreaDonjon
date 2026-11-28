import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { ABILITY_LABELS, type Ability, type Skill } from "@/src/core/rules/abilities";
import { facetsRevealedByCheck } from "@/src/core/rules/facetReveal";
import { describeKnowledge, factsToShare, rumourClaim, visibleFacetsAtSight, type KnowledgeFact } from "@/src/core/rules/npcKnowledge";
import type { NpcCheckAction } from "@/src/core/rules/npcRolls";
import { presentsIci } from "@/src/core/rules/scenePresence";
import { zInventoryBlockData, type InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { concealedMarks, markFacet } from "@/src/core/rules/concealedMarks";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { insertNpcKnowledge, listNpcKnowledge } from "@/src/server/repos/npcKnowledge";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { itemLabel, resolveCharacterActionContext } from "@/src/server/services/characterActions";
import { nameInventoryItems } from "@/src/server/services/facetDiscoveries";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { formatCpFr } from "@/src/i18n/fr";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.2-80 (ADR 0122) — Ce que les PNJ savent du personnage joué : le voir,
 * l'observer par un jet, se le dire, croire une rumeur. Tout passe par le MJ
 * du monde (en solo : la personne qui joue), et la table n'est lisible que
 * par le MJ : la personne qui joue à une table ne le lit jamais.
 */

const inventaireDe = (rows: { entity_id: string; block_type: string; data: unknown }[], entityId: string): InventoryBlockData | null => {
  const row = rows.find((r) => r.entity_id === entityId && r.block_type === "inventory");
  const lu = row ? zInventoryBlockData.safeParse(row.data) : null;
  return lu?.success ? lu.data : null;
};

/**
 * Au premier regard : chaque PNJ à fiche de la pièce retient ce que le
 * personnage porte à découvert. Seulement ce qu'il ne savait pas déjà.
 *
 * Coût (docs/QUOTAS.md), à chaque tour joué : la scène, les blocs des
 * présents et du personnage, ce qu'ils savent déjà (trois lectures) ; puis,
 * seulement s'il y a du neuf, les noms des objets et une écriture groupée.
 */
export async function observePcAtSight(
  supabase: TypedClient,
  params: { campaignId: string; world: { id: string; slug: string }; locale: Locale; pcEntityId: string; callerId: string; sessionEventId: string | null }
): Promise<number> {
  if (!(await isWorldAdmin(supabase, { worldId: params.world.id, userId: params.callerId }))) return 0;
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene) return 0;
  const ici = [...new Set(presentsIci(scene).map((p) => p.entityId))].filter((id) => id !== params.pcEntityId);
  if (ici.length === 0) return 0;

  const blocs = await listBlocksByTypesForEntities(supabase, [...ici, params.pcEntityId], ["statblock", "inventory"]);
  const temoins = ici.filter((id) => blocs.some((b) => b.entity_id === id && b.block_type === "statblock"));
  const sac = inventaireDe(blocs, params.pcEntityId);
  const visibles = visibleFacetsAtSight(sac);
  if (temoins.length === 0 || visibles.length === 0 || !sac) return 0;

  const connus = await listNpcKnowledge(supabase, { campaignId: params.campaignId, subjectId: params.pcEntityId, knowerIds: temoins });
  const manque = temoins.flatMap((knowerId) => visibles.filter((facet) => !connus.some((k) => k.knowerId === knowerId && k.facet === facet)).map((facet) => ({ knowerId, facet })));
  if (manque.length === 0) return 0;

  const ids = new Set(manque.map((m) => m.facet.slice("item:".length)));
  const noms = await nameInventoryItems(supabase, {
    world: params.world,
    locale: params.locale,
    items: sac.items.filter((i) => ids.has(i.id)).map((i) => ({ id: i.id, qty: i.qty, ...("ref" in i ? { ref: i.ref } : { label: i.label }) })),
  });
  const nomDe = new Map(noms.map((n) => [n.id, n.name]));
  const faits: KnowledgeFact[] = manque.map((m) => ({
    knowerId: m.knowerId,
    facet: m.facet,
    claim: `porte ${nomDe.get(m.facet.slice("item:".length)) ?? "un objet"}`,
    isTrue: true,
    source: "observation",
    toldById: null,
  }));
  await insertNpcKnowledge(supabase, { campaignId: params.campaignId, subjectId: params.pcEntityId, facts: faits, sourceEventId: params.sessionEventId });
  return faits.length;
}

/** Les actions de la liste fermée qui jaugent quelqu'un, et la compétence que `facetsRevealedByCheck` y lit. */
export const PC_OBSERVATION_CHECKS: Partial<Record<NpcCheckAction, Skill>> = {
  reperer: "perception",
  fouiller: "investigation",
  jauger: "insight",
  soigner: "medicine",
};

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

/**
 * Un PNJ a réussi un jet qui jauge le personnage (V3.2-52, cible `pc`) : le
 * moteur choisit ce qu'il apprend avec la même règle que dans l'autre sens
 * (`facetsRevealedByCheck` : la marge, et le DD secret d'un objet caché),
 * et le retient en mots, tel qu'il l'a vu. Rend ce qu'il a appris, pour le
 * journal du MJ seulement.
 *
 * Coût : seulement sur un tel jet réussi, la fiche calculée du personnage
 * (`resolveCharacterActionContext`), son inventaire et ce que le PNJ savait.
 */
export async function learnFromNpcCheckOnPc(
  supabase: TypedClient,
  params: { campaignId: string; npcId: string; pcEntityId: string; skill: Skill; total: number; dc: number; sourceEventId: string | null }
): Promise<string[]> {
  const [ctx, blocs, connus] = await Promise.all([
    resolveCharacterActionContext(supabase, params.pcEntityId, params.campaignId, "fr"),
    listBlocksByTypesForEntities(supabase, [params.pcEntityId], ["inventory", "text"]),
    listNpcKnowledge(supabase, { campaignId: params.campaignId, subjectId: params.pcEntityId, knowerIds: [params.npcId] }),
  ]);
  if (!ctx) return [];
  const sac = inventaireDe(blocs, params.pcEntityId);
  // V3.2-81 : ses signes distinctifs dissimulés (un tatouage sous un bandage), dans ses blocs texte.
  const marks = blocs.filter((b) => b.block_type === "text").flatMap((b) => {
    const lu = zTextBlockData.safeParse(b.data);
    return lu.success ? concealedMarks(lu.data.segments) : [];
  });
  const facettes = facetsRevealedByCheck({
    check: { kind: "skill", key: params.skill },
    total: params.total,
    dc: params.dc,
    npc: { sheet: { actions: 0, traits: 0 }, gear: sac, marks },
    known: new Set(connus.flatMap((k) => (k.facet ? [k.facet] : []))),
  });

  const faits: KnowledgeFact[] = [];
  for (const facet of facettes) {
    let claim: string | null = null;
    if (facet.startsWith("ability:")) {
      const a = ctx.sheet.abilities[facet.slice("ability:".length) as Ability];
      claim = `${ABILITY_LABELS[facet.slice("ability:".length) as Ability]} ${a.score} (${signed(a.mod)})`;
    } else if (facet === "ac") claim = `CA ${ctx.sheet.ac.value}`;
    else if (facet === "hp") claim = `${ctx.sheet.hitPoints.max} PV au plus`;
    else if (facet === "purse" && sac) {
      const c = sac.currency;
      claim = `bourse : ${formatCpFr(c.pp * 1000 + c.gp * 100 + c.ep * 50 + c.sp * 10 + c.cp)}`;
    } else if (facet.startsWith("item:") && sac) {
      const item = sac.items.find((i) => i.id === facet.slice("item:".length));
      if (item) claim = `${itemLabel(item, ctx.ruleNameByKey)}${item.concealed ? " (caché)" : ""}`;
    } else if (facet.startsWith("mark:")) {
      const mark = marks.find((m) => markFacet(m.id) === facet);
      if (mark) claim = `signe distinctif : ${mark.text.slice(0, 280)}`;
    }
    if (claim) faits.push({ knowerId: params.npcId, facet, claim, isTrue: true, source: "observation", toldById: null });
  }
  await insertNpcKnowledge(supabase, { campaignId: params.campaignId, subjectId: params.pcEntityId, facts: faits, sourceEventId: params.sourceEventId });
  return faits.map((f) => f.claim!);
}

/** Un PNJ raconte à un autre ce qu'il sait du personnage (`npc_share`). Rend le nombre de faits transmis. */
export async function shareNpcKnowledge(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; pcEntityId: string; fromId: string; toId: string; callerId: string; sourceEventId: string | null }
): Promise<number> {
  if (params.fromId === params.toId || params.fromId === params.pcEntityId || params.toId === params.pcEntityId) return 0;
  if (!(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.callerId }))) return 0;
  const tous = await listNpcKnowledge(supabase, { campaignId: params.campaignId, subjectId: params.pcEntityId, knowerIds: [params.fromId, params.toId] });
  const faits = factsToShare(
    tous.filter((k) => k.knowerId === params.fromId),
    tous.filter((k) => k.knowerId === params.toId),
    params.toId
  );
  await insertNpcKnowledge(supabase, { campaignId: params.campaignId, subjectId: params.pcEntityId, facts: faits, sourceEventId: params.sourceEventId });
  return faits.length;
}

/**
 * Le récit fait courir une rumeur sur le personnage (`npc_rumour`) : le PNJ
 * la croit, et le moteur la retient comme fausse. Une rumeur vraie n'existe
 * que par un partage (`npc_share`) de ce qu'un PNJ a vraiment appris.
 */
export async function spreadRumour(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; pcEntityId: string; npcId: string; claim: string; callerId: string; sourceEventId: string | null }
): Promise<boolean> {
  const claim = rumourClaim(params.claim);
  if (!claim || params.npcId === params.pcEntityId) return false;
  if (!(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.callerId }))) return false;
  const connus = await listNpcKnowledge(supabase, { campaignId: params.campaignId, subjectId: params.pcEntityId, knowerIds: [params.npcId] });
  if (connus.some((k) => k.facet === null && k.claim === claim)) return false;
  await insertNpcKnowledge(supabase, {
    campaignId: params.campaignId,
    subjectId: params.pcEntityId,
    facts: [{ knowerId: params.npcId, facet: null, claim, isTrue: false, source: "rumour", toldById: null }],
    sourceEventId: params.sourceEventId,
  });
  return true;
}

/**
 * Pour la narration, dans la partie réservée au MJ (ADR 0117) : une ligne par
 * PNJ présent qui sait quelque chose du personnage. Une lecture par tour
 * narré ; vide pour qui n'est pas MJ (RLS).
 */
export async function knowledgeSecrets(
  supabase: TypedClient,
  params: { campaignId: string; pcEntityId: string; pcName: string; npcs: readonly { id: string; name: string }[] }
): Promise<{ name: string; text: string }[]> {
  const faits = await listNpcKnowledge(supabase, { campaignId: params.campaignId, subjectId: params.pcEntityId, knowerIds: params.npcs.map((n) => n.id) });
  const nomDe = (id: string) => params.npcs.find((n) => n.id === id)?.name ?? "quelqu'un";
  return params.npcs.flatMap((npc) => {
    const ligne = describeKnowledge(
      faits.filter((f) => f.knowerId === npc.id),
      nomDe
    );
    return ligne ? [{ name: npc.name, text: `ce qu'il ou elle sait de ${params.pcName} — ${ligne}` }] : [];
  });
}
