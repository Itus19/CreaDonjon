import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { campsDuCombat, surprisDuCombat, type LiensEnvers, type PresentAuCombat } from "@/src/core/rules/combatCamps";
import { rollInitiative } from "@/src/core/rules/combat";
import { combineAdvantage } from "@/src/core/rules/action";
import { presentsIci } from "@/src/core/rules/scenePresence";
import { archetypeCalcule } from "@/src/core/rules/sceneLife";
import { axesDepuisJson } from "@/src/core/psyche/perception";
import { zPersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import { zWorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import { espritDeCombat, type EspritDeCombat } from "@/src/core/rules/combatMinds";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { listAttitudesTowardTarget } from "@/src/server/repos/psyche";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { insertCombat, listCombatsForCampaign, updateCombatParticipant } from "@/src/server/repos/combats";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { addEntityParticipant, initiativeForParticipant, setCombatStatus } from "@/src/server/services/combats";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { serverRng } from "@/src/server/services/rng";

type TypedClient = SupabaseClient<Database>;

export interface CombatOuvert {
  combatId: string;
  /** La CA de la cible lue sur sa fiche, `null` si elle n'a pas pu entrer (pas de fiche). */
  cibleAc: number | null;
  /** Le fait pour le récit : qui contre qui, qui est surpris. */
  fait: string;
}

/**
 * ADR 0121 — Le moteur ouvre un combat en solo quand la personne qui joue
 * attaque un présent. Les camps viennent de `campsDuCombat`, la surprise de
 * `surprisDuCombat` (règle 2024 : désavantage à l'initiative), les CA et PV
 * des fiches (`addEntityParticipant`). Le serveur lance toutes les
 * initiatives ; la pastille d'initiative du personnage viendra avec V3.2-68.
 *
 * Rien n'est ouvert : hors partie solo (seul un administrateur du monde écrit
 * un combat, migration 20261010120000), quand un combat tourne déjà, ou
 * quand la cible n'est pas un présent de la scène.
 *
 * Coût (docs/QUOTAS.md) : une fois par combat, quatre lectures groupées
 * (attitudes envers l'agresseur, envers la cible, tempéraments, visions du
 * monde pour le but et le moral de l'ADR 0122), puis une
 * écriture par participant. Rien à chaque tour.
 */
export async function ouvrirCombatSolo(
  supabase: TypedClient,
  params: { campaignId: string; worldId: string; actorEntityId: string; targetEntityId: string; callerId: string; locale: Locale }
): Promise<CombatOuvert | null> {
  const [admin, scene, combats] = await Promise.all([
    isWorldAdmin(supabase, { worldId: params.worldId, userId: params.callerId }),
    getSceneState(supabase, params.campaignId),
    listCombatsForCampaign(supabase, params.campaignId),
  ]);
  if (!admin || !scene || combats.some((c) => c.status === "running")) return null;
  const ici = presentsIci(scene).filter((p) => p.entityId !== params.actorEntityId);
  if (!ici.some((p) => p.entityId === params.targetEntityId)) return null;

  const ids = ici.map((p) => p.entityId);
  const [versAgresseur, versCible, temperaments, visions, entites] = await Promise.all([
    listAttitudesTowardTarget(supabase, { campaignId: params.campaignId, sourceEntityIds: ids, targetEntityId: params.actorEntityId }),
    listAttitudesTowardTarget(supabase, { campaignId: params.campaignId, sourceEntityIds: ids, targetEntityId: params.targetEntityId }),
    listBlocksByTypeForEntities(supabase, ids, "personality"),
    listBlocksByTypeForEntities(supabase, ids, "worldview"),
    listEntitiesByIds(supabase, [params.actorEntityId, ...ids]),
  ]);

  const liens = (rows: typeof versAgresseur, id: string): LiensEnvers | undefined => {
    const axes = axesDepuisJson(rows.find((r) => r.source_entity_id === id)?.axes);
    if (!axes) return undefined;
    return { amitie: axes.friendship_hostility, dette: axes.debt_independence, peur: axes.fear_assurance };
  };
  const temperament = (id: string) => {
    const bloc = temperaments.find((b) => b.entity_id === id);
    const parsed = bloc ? zPersonalityBlockData.safeParse(bloc.data) : null;
    return parsed?.success ? parsed.data : null;
  };
  const impulsivite = (id: string): number | undefined => temperament(id)?.poles.find((p) => p.key === "impulse_prudence")?.value;
  const convictions = (id: string) => {
    const bloc = visions.find((b) => b.entity_id === id);
    const parsed = bloc ? zWorldviewBlockData.safeParse(bloc.data) : null;
    return parsed?.success ? Object.fromEntries(parsed.data.poles.map((p) => [p.key, p.value])) : {};
  };
  const archetype = (id: string): string | null => {
    const seed = scene.life?.workers.find((w) => w.entityId === id)?.seed;
    return seed === undefined ? null : archetypeCalcule(scene, seed);
  };

  const presents: PresentAuCombat[] = ici.map((p) => {
    const envers: Record<string, LiensEnvers> = {};
    const a = liens(versAgresseur, p.entityId);
    const c = liens(versCible, p.entityId);
    if (a) envers[params.actorEntityId] = a;
    if (c) envers[params.targetEntityId] = c;
    const imp = impulsivite(p.entityId);
    return { id: p.entityId, zone: p.zone, archetype: archetype(p.entityId), envers, ...(imp !== undefined ? { impulsivite: imp } : {}) };
  });

  const graine = `${params.campaignId}:${scene.time.day}:${scene.time.hour}:${scene.time.minute}`;
  const camps = campsDuCombat({
    agresseurId: params.actorEntityId,
    cibleId: params.targetEntityId,
    presents,
    // Une ville en agrégat autour de la scène : la garde y fait la loi.
    juridictionGarde: scene.life !== null && scene.life !== undefined,
    graine,
  });
  const surpris = new Set(surprisDuCombat({ camps, agresseurId: params.actorEntityId, presents, agresseurCache: false }));

  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  const combat = await insertCombat(supabase, { campaignId: params.campaignId, sessionId, name: null });

  // En série : `addEntityParticipant` calcule l'ordre d'affichage d'après les lignes déjà écrites.
  let cibleAc: number | null = null;
  const entres: { id: string; participantId: string; label: string }[] = [];
  for (const [id, allie] of [...camps.agresseurs.map((i) => [i, true] as const), ...camps.defenseurs.map((i) => [i, false] as const)]) {
    const ligne = await addEntityParticipant(supabase, { combatId: combat.id, entityId: id, campaignId: params.campaignId, locale: params.locale, isAlly: allie });
    if (!ligne) continue;
    if (id === params.targetEntityId) cibleAc = ligne.ac;
    entres.push({ id, participantId: ligne.id, label: ligne.label });
    const init = await initiativeForParticipant(supabase, ligne, params.campaignId, params.locale);
    const avantage = surpris.has(id) ? combineAdvantage("disadvantage", init.advantage) : init.advantage;
    await updateCombatParticipant(supabase, ligne.id, { initiative: rollInitiative(init.mod, serverRng, avantage) });
  }

  // ADR 0122 : le but et le moral de chaque PNJ entré, fixés une fois pour tout le combat.
  const esprits: Record<string, EspritDeCombat> = {};
  for (const e of entres) {
    if (e.id === params.actorEntityId) continue;
    const present = presents.find((p) => p.id === e.id);
    const t = temperament(e.id);
    esprits[e.id] = espritDeCombat({
      id: e.id,
      archetype: present?.archetype ?? null,
      camp: camps.agresseurs.includes(e.id) ? "agresseur" : "defenseur",
      agresseurId: params.actorEntityId,
      cibleId: params.targetEntityId,
      envers: present?.envers ?? {},
      poles: Object.fromEntries((t?.poles ?? []).map((p) => [p.key, p.value])),
      convictions: convictions(e.id),
      aspirationsDeVie: (t?.aspirations ?? []).filter((a) => a.horizon === "life").reduce((s, a) => s + a.intensity, 0),
    });
  }

  await setCombatStatus(supabase, { combatId: combat.id, status: "running", actorUserId: params.callerId });
  await putSceneState(supabase, {
    campaignId: params.campaignId,
    state: { ...scene, activeCombatId: combat.id, combatMinds: { combatId: combat.id, agresseurId: params.actorEntityId, cibleId: params.targetEntityId, esprits } },
    updatedBy: params.callerId,
  });

  const nom = new Map(entites.map((e) => [e.id, e.name]));
  const liste = (lot: string[]) => lot.map((id) => nom.get(id) ?? "quelqu'un").join(", ");
  const surprisNoms = [...surpris].filter((id) => entres.some((e) => e.id === id));
  const fait =
    `Le combat commence : ${liste(camps.agresseurs)} contre ${liste(camps.defenseurs)}.` +
    (surprisNoms.length > 0 ? ` Pris par surprise : ${liste(surprisNoms)}.` : "") +
    (camps.horsCombat.length > 0 ? ` Restent à l'écart : ${liste(camps.horsCombat.map((h) => h.id))}.` : "");
  return { combatId: combat.id, cibleAc, fait };
}
