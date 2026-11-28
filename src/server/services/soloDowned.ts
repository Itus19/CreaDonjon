import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { isDying, UNCONSCIOUS } from "@/src/core/rules/deathSaves";

/** Ce que le tour devient pour un personnage à terre : un jet contre la mort, ou rien, la partie étant finie. */
export type TourATerre = { kind: "jet"; phrase: string } | { kind: "mort" };
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { advanceSceneTime } from "@/src/core/rules/scene";
import { serverRng } from "@/src/server/services/rng";
import { listCombatParticipants, updateCombatParticipant } from "@/src/server/repos/combats";
import { rollDeathSaveForCharacter } from "@/src/server/services/characterActions";
import type { SortDuVaincu } from "@/src/core/rules/combatMinds";
import { totalValueCp } from "@/src/core/rules/currency";
import { tradeForTab } from "@/src/core/rules/tradeIntent";
import { formatCpFr } from "@/src/i18n/fr";
import { applyRuntimeStateChange, getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { applyTrade, readInventorySnapshot } from "@/src/server/services/inventoryActions";
import { readCurrencySystemForEntity } from "@/src/server/services/currencySystem";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";

type TypedClient = SupabaseClient<Database>;

/**
 * Le personnage à terre en solo : à 0 PV, ni stabilisé ni mort, son tour
 * est un jet contre la mort, quoi que dise la phrase (règles 2024). Le d20
 * vient du serveur (`rollDeathSaveForCharacter`, règle 8), qui l'inscrit à
 * l'historique des dés et change l'état de jeu par le chemin journalisé.
 *
 * Rend la phrase du tour (« Jet contre la mort : 12 — réussite… »),
 * `{ kind: "mort" }` quand il est mort (trois échecs) : en solo, la partie
 * est terminée, choix de l'auteur ; sinon `null`, et le tour se joue
 * normalement. Sur un 20, il se relève à 1 PV, et sa ligne de combat suit.
 *
 * Coût (docs/QUOTAS.md) : une lecture de l'état de jeu par tour en partie ;
 * le jet lui-même seulement quand il est mourant.
 */
export async function jetContreLaMortDuTour(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; callerId: string; locale: Locale }
): Promise<TourATerre | null> {
  const etat = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  if (etat.death_saves.fail >= 3) return { kind: "mort" };
  if (etat.hp.current === 0 && etat.death_saves.success >= 3) return reveilDuStabilise(supabase, params, etat.conditions);
  if (!isDying({ hp: etat.hp, deathSaves: etat.death_saves })) return null;
  const jet = await rollDeathSaveForCharacter(supabase, { entityId: params.entityId, campaignId: params.campaignId, natural: null, actorUserId: params.callerId, locale: params.locale });
  if (!jet.ok) return null;

  if (jet.revived) {
    const scene = await getSceneState(supabase, params.campaignId);
    if (scene?.activeCombatId) {
      const ligne = (await listCombatParticipants(supabase, scene.activeCombatId)).find((p) => p.entity_id === params.entityId);
      if (ligne) await updateCombatParticipant(supabase, ligne.id, { hpCurrent: 1 });
    }
  }

  const compte = `réussites ${jet.deathSaves.success}/3, échecs ${jet.deathSaves.fail}/3`;
  const phrase = (texte: string): TourATerre => ({ kind: "jet", phrase: texte });
  if (jet.revived) return phrase(`Jet contre la mort : 20 naturel — se relève avec 1 PV.`);
  if (jet.dead) return phrase(`Jet contre la mort : ${jet.natural} — échec (${compte}). Mort : la partie est terminée.`);
  if (jet.stabilized) return phrase(`Jet contre la mort : ${jet.natural} — réussite (${compte}). Stabilisé·e, hors de danger mais inconscient·e.`);
  return phrase(`Jet contre la mort : ${jet.natural} — ${jet.natural >= 10 ? "réussite" : jet.natural === 1 ? "1 naturel, deux échecs" : "échec"} (${compte}).`);
}

/**
 * ADR 0123 — Le combat perdu : ce que le vainqueur fait du personnage à
 * terre, issue décidée par `sortDuVaincu` (le moteur, selon le but). Écrit
 * l'état de jeu par le chemin journalisé et rend le fait du tour.
 *
 * - `capture` : la garde le ligote (Entravé) et panse ses plaies (stabilisé).
 * - `detrousse` : sa bourse part, toute (une vente au prix de la table).
 * - `acheve` : trois échecs aux jets contre la mort ; en solo, la partie est terminée.
 * - `laisse` : rien ne change ; il reste à terre, ses jets continuent.
 *
 * Coût (docs/QUOTAS.md) : une fois par combat perdu, une lecture de l'état
 * de jeu, et pour un détroussage la bourse et le système monétaire.
 */
export async function sortDuPersonnageVaincu(
  supabase: TypedClient,
  params: { campaignId: string; callerId: string; pjEntityId: string; pjLabel: string; vainqueur: string; sort: SortDuVaincu }
): Promise<string> {
  const etat = await getEntityRuntimeState(supabase, params.pjEntityId, params.campaignId);
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  const ecrire = (patch: Parameters<typeof applyRuntimeStateChange>[1]["patch"], note: string) =>
    applyRuntimeStateChange(supabase, { entityId: params.pjEntityId, campaignId: params.campaignId, patch, note, sessionId, actor: "system", actorUserId: null });

  if (params.sort === "capture") {
    const conditions = etat.conditions.includes("restrained") ? etat.conditions : [...etat.conditions, "restrained"];
    await ecrire({ conditions, death_saves: etat.death_saves.fail >= 3 ? etat.death_saves : { success: 3, fail: etat.death_saves.fail } }, `Capturé par ${params.vainqueur}`);
    return `${params.vainqueur} ligote ${params.pjLabel} (Entravé·e) et panse ses plaies : capturé·e.`;
  }
  if (params.sort === "acheve") {
    await ecrire({ death_saves: { success: 0, fail: 3 } }, `Achevé par ${params.vainqueur}`);
    return `${params.vainqueur} achève ${params.pjLabel}. Mort : la partie est terminée.`;
  }
  if (params.sort === "detrousse") {
    const [systeme, sac] = await Promise.all([
      readCurrencySystemForEntity(supabase, { entityId: params.pjEntityId, campaignId: params.campaignId }),
      readInventorySnapshot(supabase, params.pjEntityId),
    ]);
    const bourse = sac ? totalValueCp(sac.currency, systeme) : 0;
    if (bourse === 0) return `${params.vainqueur} fouille ${params.pjLabel} et ne trouve pas une pièce.`;
    const pris = await applyTrade(supabase, { entityId: params.pjEntityId, trade: tradeForTab(bourse), actorUserId: params.callerId, system: systeme });
    if ("error" in pris || "status" in pris) return `${params.vainqueur} fouille ${params.pjLabel}, sans rien emporter.`;
    return `${params.vainqueur} détrousse ${params.pjLabel} : sa bourse (${formatCpFr(bourse)}) disparaît.`;
  }
  return `${params.vainqueur} laisse ${params.pjLabel} à terre.`;
}

/**
 * Stabilisé, à 0 PV : il ne peut pas agir. En combat, son tour passe ; hors
 * combat, il reprend 1 PV au bout de 1d4 heures (règles 2024), que le serveur
 * lance et que l'horloge de la scène compte.
 */
async function reveilDuStabilise(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; callerId: string },
  conditions: string[]
): Promise<TourATerre> {
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene || scene.activeCombatId) return { kind: "jet", phrase: "Inconscient·e mais stabilisé·e : rien à faire ce tour." };
  const heures = serverRng.nextInt(4) + 1;
  await putSceneState(supabase, { campaignId: params.campaignId, state: advanceSceneTime(scene, heures * 60), updatedBy: params.callerId });
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { hp: { current: 1 }, conditions: conditions.filter((c) => c !== UNCONSCIOUS), death_saves: { success: 0, fail: 0 } },
    note: `Reprend connaissance (1d4 heures : ${heures})`,
    sessionId,
    actor: "system",
    actorUserId: null,
  });
  return { kind: "jet", phrase: `Stabilisé·e, reprend connaissance au bout de ${heures} heure${heures > 1 ? "s" : ""} (1d4) avec 1 PV.` };
}
