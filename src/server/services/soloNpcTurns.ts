import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { DAMAGE_TYPE_LABELS_FR, npcAttacks, resoudreAttaquePnj, tactiqueDuPnj, type ZoneCombat } from "@/src/core/rules/npcRolls";
import type { ResolvedEffect } from "@/src/core/rules/triggers";
import { zStatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { getCombatById, listCombatParticipants, updateCombat } from "@/src/server/repos/combats";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { orderParticipants } from "@/src/server/services/combats";
import { applyResolvedEffects } from "@/src/server/services/targetedRoll";
import { serverRng } from "@/src/server/services/rng";

type TypedClient = SupabaseClient<Database>;

/**
 * ADR 0121, point 5 (V3.2-73) — Les PNJ du combat jouent leur tour, entre deux
 * tours de la personne qui joue : chacun une fois, dans l'ordre
 * d'initiative qui suit le sien, puis le round avance.
 *
 * Le moteur choisit l'action (`tactiqueDuPnj` : la tactique fixe de l'ADR),
 * lance l'attaque et les dégâts avec les valeurs de la fiche allégée
 * (`resoudreAttaquePnj`, `serverRng`, règle 8), puis applique les dégâts par
 * le même cœur que la table (`applyResolvedEffects`). Le choix par l'IA dans
 * une liste fermée viendra par-dessus ; cette fonction n'appelle jamais de
 * modèle (`turnIntent.noAi.test.ts`).
 *
 * Rend les faits, que le récit raconte et que la ligne du tour montre.
 * Coût (docs/QUOTAS.md) : à chaque tour EN COMBAT seulement, le combat, ses
 * participants, la scène et les fiches des PNJ (quatre lectures), puis une
 * écriture par PV changé et un événement de journal.
 */
export async function jouerTourDesPnj(
  supabase: TypedClient,
  params: { campaignId: string; callerId: string; pcEntityId: string }
): Promise<string[]> {
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene?.activeCombatId) return [];
  const [combat, lignes] = await Promise.all([getCombatById(supabase, scene.activeCombatId), listCombatParticipants(supabase, scene.activeCombatId)]);
  if (!combat || combat.status !== "running") return [];

  const ordre = orderParticipants(lignes);
  const rangPj = ordre.findIndex((p) => p.entity_id === params.pcEntityId);
  if (rangPj < 0) return [];
  const pj = ordre[rangPj]!;
  // Ceux qui suivent le personnage dans l'ordre, puis ceux d'avant : un tour de table, jusqu'à lui.
  const suite = [...ordre.slice(rangPj + 1), ...ordre.slice(0, rangPj)];

  const entites = suite.map((p) => p.entity_id).filter((id): id is string => id !== null);
  const fiches = new Map<string, ReturnType<typeof npcAttacks>>();
  for (const b of await listBlocksByTypeForEntities(supabase, entites, "statblock")) {
    const parsed = zStatblockBlockData.safeParse(b.data);
    if (parsed.success) fiches.set(b.entity_id, npcAttacks(parsed.data.actions));
  }

  const pv = new Map(lignes.map((p) => [p.id, p.hp_current ?? 0]));
  const zones = new Map(scene.present.map((p) => [p.entityId, p.zone as ZoneCombat]));
  const faits: string[] = [];
  const effets: ResolvedEffect[] = [];
  let present = scene.present;

  for (const pnj of suite) {
    if ((pv.get(pnj.id) ?? 0) <= 0 || !pnj.entity_id) continue;
    const attaques = fiches.get(pnj.entity_id);
    if (!attaques) continue; // une fiche de personnage (un compagnon bâti à la main) : pas encore joué par le moteur
    const ennemis = lignes
      .filter((p) => p.is_ally !== pnj.is_ally && (pv.get(p.id) ?? 0) > 0)
      .map((p) => ({ id: p.id, joueur: p.id === pj.id }));
    const zone = zones.get(pnj.entity_id) ?? "engaged";
    const action = tactiqueDuPnj({ zone, attaques, ennemis });

    if (action.kind === "dodge") {
      faits.push(`${pnj.label} esquive (action Esquiver).`);
      continue;
    }
    if (action.kind === "approach") {
      faits.push(`${pnj.label} s'approche.`);
      present = present.map((p) => (p.entityId === pnj.entity_id ? { ...p, zone: "near" } : p));
      continue;
    }
    if (action.approche) present = present.map((p) => (p.entityId === pnj.entity_id ? { ...p, zone: "engaged" } : p));

    const cible = lignes.find((p) => p.id === action.targetId)!;
    const jet = resoudreAttaquePnj(action.attack, cible.ac, serverRng);
    const types = [...new Set(action.attack.damage.map((d) => DAMAGE_TYPE_LABELS_FR[d.type] ?? d.type))].join(" et ");
    const verdict = jet.touche === null ? "" : jet.touche ? ` contre CA ${cible.ac} — touché` : ` contre CA ${cible.ac} — raté`;
    faits.push(
      `${pnj.label}${action.approche ? " s'approche et" : ""} attaque ${cible.label} avec ${action.attack.name} : ${jet.total} (dé : ${jet.naturel})${verdict}` +
        `${jet.critique ? " — critique" : jet.naturel === 1 ? " — échec critique" : ""}.` +
        (jet.touche ? ` Dégâts : ${jet.degats}${types ? ` ${types}` : ""}.` : "")
    );
    if (jet.touche && jet.degats > 0) {
      effets.push({ action: "deal_damage", who: `participant:${cible.id}`, amount: jet.degats });
      pv.set(cible.id, Math.max(0, (pv.get(cible.id) ?? 0) - jet.degats));
    }
  }

  if (faits.length === 0) return [];

  // Les PV : le même cœur que la table, qui écrit la ligne du participant et l'état de jeu du personnage.
  const { changes } = effets.length > 0
    ? await applyResolvedEffects(supabase, {
        campaignId: params.campaignId,
        callerId: params.callerId,
        actor: null,
        scene,
        spend: null,
        effects: effets,
        note: "Tour des PNJ",
        fromEventId: null,
        combatId: combat.id,
      })
    : { changes: [] as string[] };

  await updateCombat(supabase, combat.id, { round: combat.round + 1 });
  if (present !== scene.present) {
    const apres = await getSceneState(supabase, params.campaignId);
    if (apres) await putSceneState(supabase, { campaignId: params.campaignId, state: { ...apres, present }, updatedBy: params.callerId });
  }

  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  await insertSessionEvent(supabase, {
    sessionId,
    seq: await nextEventSeq(supabase, sessionId),
    kind: "rule_application",
    actor: "system",
    actorUserId: null,
    payload: { __v: 1, source: "npc_turns", changes_text: [...faits, ...changes], hints_text: [], ignored_text: [] } as unknown as Json,
  });
  return [...faits, ...changes];
}
