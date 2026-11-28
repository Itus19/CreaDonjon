import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { DAMAGE_TYPE_LABELS_FR, npcAttacks, resoudreAttaquePnj, tactiqueDuPnj, type ZoneCombat } from "@/src/core/rules/npcRolls";
import type { ResolvedEffect } from "@/src/core/rules/triggers";
import { declencheursDeMoral, testDeMoral, type EtatDeCombat, type EspritDeCombat } from "@/src/core/rules/combatMinds";
import { zStatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { getCombatById, listCombatParticipants, updateCombat } from "@/src/server/repos/combats";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { endCombat, orderParticipants } from "@/src/server/services/combats";
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
 * ADR 0122 : chaque PNJ teste son moral au début de son tour (fuir, se
 * rendre, tenir) et vise selon son but ; le combat se clôt quand plus aucun
 * ennemi du personnage ne veut ou ne peut se battre.
 *
 * Coût (docs/QUOTAS.md) : à chaque tour EN COMBAT seulement, le combat, ses
 * participants, la scène et les fiches des PNJ (quatre lectures), puis une
 * écriture par PV changé, une écriture de scène quand une zone ou un moral
 * change, et un événement de journal.
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

  // ADR 0122 : le but et le moral fixés à l'ouverture. Un combat ouvert par le MJ n'en a pas : les PNJ veulent vaincre et ne lâchent pas.
  const minds = scene.combatMinds?.combatId === combat.id ? scene.combatMinds : null;
  const esprits = new Map<string, EspritDeCombat>(Object.entries(minds?.esprits ?? {}));
  const etat = (p: { entity_id: string | null }): EtatDeCombat => (p.entity_id ? (esprits.get(p.entity_id)?.etat ?? "combat") : "combat");
  const auCombat = (p: { id: string; entity_id: string | null }) => (pv.get(p.id) ?? 0) > 0 && etat(p) === "combat";
  const campAgresseur = lignes.find((p) => p.entity_id === minds?.agresseurId)?.is_ally ?? pj.is_ally;
  let espritsChanges = false;

  for (const pnj of suite) {
    if (!auCombat(pnj) || !pnj.entity_id) continue;
    const attaques = fiches.get(pnj.entity_id);
    if (!attaques) continue; // une fiche de personnage (un compagnon bâti à la main) : pas encore joué par le moteur
    const zone = zones.get(pnj.entity_id) ?? "engaged";
    const allies = lignes.filter((p) => p.is_ally === pnj.is_ally && p.id !== pnj.id);
    const adversaires = lignes.filter((p) => p.is_ally !== pnj.is_ally);

    // Le test de moral, au début de son tour (ADR 0122, point 3).
    const esprit = esprits.get(pnj.entity_id);
    if (esprit) {
      const pvMax = pnj.hp_max ?? 0;
      const declencheurs = declencheursDeMoral({
        pv: pv.get(pnj.id) ?? 0,
        pvMax,
        alliesTombes: allies.filter((p) => !auCombat(p)).map((p) => p.id),
        alliesDebout: allies.filter(auCombat).length,
        ennemisDebout: adversaires.filter(auCombat).length,
        testes: esprit.testes,
      });
      const { esprit: apres, jet } = testDeMoral(esprit, declencheurs, { engage: zone === "engaged", pv: pv.get(pnj.id) ?? 0, pvMax }, serverRng);
      if (jet) {
        esprits.set(pnj.entity_id, apres);
        espritsChanges = true;
        const lu = `moral : ${jet.total} (dé : ${jet.naturel}) contre DD ${jet.dd}`;
        if (apres.etat === "fuite") {
          faits.push(`${pnj.label} perd courage (${lu}) et s'enfuit.`);
          present = present.filter((p) => p.entityId !== pnj.entity_id);
          continue;
        }
        if (apres.etat === "rendu") {
          faits.push(`${pnj.label} perd courage (${lu}) et se rend.`);
          continue;
        }
        faits.push(`${pnj.label} tient bon (${lu}).`);
      }
    }

    // Celui qui menace ce qu'il défend : l'agresseur pour la défense, la cible pour l'attaque.
    const menace = pnj.is_ally === campAgresseur ? minds?.cibleId : minds?.agresseurId;
    const ennemis = adversaires
      .filter(auCombat)
      .map((p) => ({ id: p.id, joueur: p.id === pj.id, pv: pv.get(p.id) ?? 0, menace: p.entity_id !== null && p.entity_id === menace }));
    const action = tactiqueDuPnj({ zone, attaques, ennemis, ...(esprit ? { but: esprit.but } : {}) });

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

  // ADR 0122, point 5 : plus aucun ennemi du personnage ne veut ou ne peut se battre.
  const fini = lignes.some((p) => p.is_ally !== pj.is_ally) && lignes.filter((p) => p.is_ally !== pj.is_ally).every((p) => !auCombat(p));
  if (fini) faits.push("Le combat est terminé.");
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
  if (present !== scene.present || espritsChanges || fini) {
    const apres = await getSceneState(supabase, params.campaignId);
    if (apres) {
      const state = { ...apres, present };
      if (!fini && minds) state.combatMinds = { ...minds, esprits: Object.fromEntries(esprits) };
      else delete state.combatMinds;
      await putSceneState(supabase, { campaignId: params.campaignId, state, updatedBy: params.callerId });
    }
  }
  // Après l'écriture de la scène : `endCombat` la relit pour avancer l'heure et oublier le combat.
  if (fini) await endCombat(supabase, { combatId: combat.id, actorUserId: params.callerId });

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
