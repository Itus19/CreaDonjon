import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { isDying, UNCONSCIOUS } from "@/src/core/rules/deathSaves";

/** Ce que le tour devient pour un personnage à terre : un jet contre la mort, ou rien, la partie étant finie. */
export type TourATerre = { kind: "jet"; phrase: string } | { kind: "mort" };
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { advanceSceneTime, pieceCourante } from "@/src/core/rules/scene";
import { pieceDeCaptivite } from "@/src/core/rules/rooms";
import { zRoomsBlockData } from "@/src/core/schemas/blocks/rooms";
import { listRelationsForEntity } from "@/src/server/repos/relations";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { moveSceneAfterNarration } from "@/src/server/services/narrationScene";
import { serverRng } from "@/src/server/services/rng";
import { listCombatParticipants, updateCombatParticipant } from "@/src/server/repos/combats";
import { rollDeathSaveForCharacter } from "@/src/server/services/characterActions";
import type { SortDuVaincu } from "@/src/core/rules/combatMinds";
import { totalValueCp } from "@/src/core/rules/currency";
import { butinVisible } from "@/src/core/rules/loot";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
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

/** Le fait du tour, et le sac du voleur tel qu'il était, pour « Annuler ce tour ». */
export interface IssueDuVaincu {
  fait: string;
  inventaireAvant?: { entity_id: string; inventory: InventoryBlockData | null };
}

/**
 * ADR 0123 — Le combat perdu : ce que le vainqueur fait du personnage à
 * terre, issue décidée par `sortDuVaincu` (le moteur, selon le but). Écrit
 * l'état de jeu par le chemin journalisé et rend le fait du tour.
 *
 * - `capture` : la garde le ligote (Entravé) et panse ses plaies (stabilisé).
 * - `detrousse` : sa bourse et ce qu'il tient en main (`butinVisible`) passent dans le sac du voleur.
 * - `acheve` : trois échecs aux jets contre la mort ; en solo, la partie est terminée.
 * - `laisse` : rien ne change ; il reste à terre, ses jets continuent.
 *
 * Coût (docs/QUOTAS.md) : une fois par combat perdu, une lecture de l'état
 * de jeu, et pour un détroussage la bourse et le système monétaire.
 */
export async function sortDuPersonnageVaincu(
  supabase: TypedClient,
  params: { campaignId: string; callerId: string; pjEntityId: string; pjLabel: string; vainqueur: string; vainqueurEntityId: string | null; sort: SortDuVaincu }
): Promise<IssueDuVaincu> {
  const etat = await getEntityRuntimeState(supabase, params.pjEntityId, params.campaignId);
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  const ecrire = (patch: Parameters<typeof applyRuntimeStateChange>[1]["patch"], note: string) =>
    applyRuntimeStateChange(supabase, { entityId: params.pjEntityId, campaignId: params.campaignId, patch, note, sessionId, actor: "system", actorUserId: null });

  if (params.sort === "capture") {
    const conditions = etat.conditions.includes("restrained") ? etat.conditions : [...etat.conditions, "restrained"];
    await ecrire({ conditions, death_saves: etat.death_saves.fail >= 3 ? etat.death_saves : { success: 3, fail: etat.death_saves.fail } }, `Capturé par ${params.vainqueur}`);
    return { fait: `${params.vainqueur} ligote ${params.pjLabel} (Entravé·e) et panse ses plaies : capturé·e.` };
  }
  if (params.sort === "acheve") {
    await ecrire({ death_saves: { success: 0, fail: 3 } }, `Achevé par ${params.vainqueur}`);
    return { fait: `${params.vainqueur} achève ${params.pjLabel}. Mort : la partie est terminée.` };
  }
  if (params.sort === "detrousse") {
    if (!params.vainqueurEntityId) return { fait: `${params.vainqueur} fouille ${params.pjLabel}, sans rien emporter.` };
    const [systeme, sac, sacDuVoleur] = await Promise.all([
      readCurrencySystemForEntity(supabase, { entityId: params.pjEntityId, campaignId: params.campaignId }),
      readInventorySnapshot(supabase, params.pjEntityId),
      readInventorySnapshot(supabase, params.vainqueurEntityId),
    ]);
    const butin = sac ? butinVisible(sac) : { give: [], receive: [], objets: 0 };
    if (butin.give.length === 0) return { fait: `${params.vainqueur} fouille ${params.pjLabel} et ne trouve rien à prendre.` };
    const pris = await applyTrade(supabase, { entityId: params.pjEntityId, trade: { give: butin.give, receive: [] }, actorUserId: params.callerId, system: systeme });
    if ("error" in pris || "status" in pris) {
      console.error("Détroussage non appliqué au personnage", params.pjEntityId, pris);
      return { fait: `${params.vainqueur} fouille ${params.pjLabel}, sans rien emporter.` };
    }
    // Ce qui sort d'un sac entre dans l'autre, par le même règlement qu'une vente. « Annuler ce tour » remet le sac du voleur.
    const recu = await applyTrade(supabase, { entityId: params.vainqueurEntityId, trade: { give: [], receive: butin.receive }, actorUserId: params.callerId, system: systeme });
    if ("error" in recu || "status" in recu) console.error("Butin non rangé chez le voleur", params.vainqueurEntityId, recu);
    const bourse = sac ? totalValueCp(sac.currency, systeme) : 0;
    const quoi = [bourse > 0 ? `sa bourse (${formatCpFr(bourse)})` : null, butin.objets > 0 ? "ce qu'il y avait dans ses mains" : null].filter(Boolean).join(" et ");
    return {
      fait: `${params.vainqueur} détrousse ${params.pjLabel} et emporte ${quoi}.`,
      inventaireAvant: { entity_id: params.vainqueurEntityId, inventory: sacDuVoleur },
    };
  }
  return { fait: `${params.vainqueur} laisse ${params.pjLabel} à terre.` };
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

/**
 * ADR 0123 — Le personnage capturé est emmené : au lieu où travaille le garde
 * (son lien `works_at`), s'il en a un, sinon il reste dans ce lieu ; puis
 * enfermé seul, le garde dehors (`pieceDeCaptivite` : une cellule du wiki, une cellule
 * esquissée, ou une pièce fermée à clé). Après la fin du combat : un
 * déplacement de scène est refusé tant qu'un combat court. Rend le fait du tour.
 *
 * Coût (docs/QUOTAS.md) : une fois par capture, les liens du garde, la
 * campagne, les pièces du lieu, et l'écriture de la scène.
 */
export async function emmenerEnCaptivite(
  supabase: TypedClient,
  params: { campaignId: string; callerId: string; pjEntityId: string; pjLabel: string; gardeEntityId: string; gardeLabel: string }
): Promise<string> {
  const [liens, campagne, avant] = await Promise.all([
    listRelationsForEntity(supabase, params.gardeEntityId),
    getCampaignById(supabase, params.campaignId),
    getSceneState(supabase, params.campaignId),
  ]);
  if (!avant || !campagne) return `${params.gardeLabel} garde ${params.pjLabel} sous bonne garde.`;
  const poste = liens.find((l) => l.relation_type === "works_at" && l.direction === "out" && l.other)?.other ?? null;
  if (poste && poste.id !== avant.locationId) {
    await moveSceneAfterNarration(supabase, { campaignId: params.campaignId, worldId: campagne.world_id, callerId: params.callerId, playerEntityId: params.pjEntityId, locationId: poste.id, followers: [params.gardeEntityId] });
  }
  const scene = (await getSceneState(supabase, params.campaignId)) ?? avant;
  // Les pièces que la page du lieu montre ; une pièce secrète du MJ ne sert pas de cellule.
  const blocs = (await listBlocksByTypeForEntities(supabase, [scene.locationId], "rooms")).filter((b) => b.visibility_level !== "gm");
  const wikiRooms = blocs.flatMap((b) => {
    const lu = zRoomsBlockData.safeParse(b.data);
    if (!lu.success) console.error("Bloc rooms illisible, ignoré pour la captivité", b.id, lu.error.issues);
    return lu.success ? lu.data.rooms : [];
  });
  const enferme = pieceDeCaptivite(scene, { wikiRooms, pjId: params.pjEntityId, lieuDeGarde: poste !== null });
  await putSceneState(supabase, { campaignId: params.campaignId, state: enferme, updatedBy: params.callerId });
  const ou = pieceCourante(enferme) ?? "une pièce fermée";
  const vers = poste && scene.locationId === poste.id ? ` ${aLieu(poste.name)}` : "";
  return `${params.gardeLabel} emmène ${params.pjLabel}${vers} et l'enferme dans ${ou.charAt(0).toLowerCase()}${ou.slice(1)}.`;
}

/** « à » devant un nom de lieu, contracté avec son article : au poste, aux docks, à la forge, à Valmont. */
function aLieu(nom: string): string {
  if (/^(la\s|l['’])/i.test(nom)) return `à ${nom.charAt(0).toLowerCase()}${nom.slice(1)}`;
  const m = /^(le|les)\s+(.*)$/i.exec(nom);
  if (!m) return `à ${nom}`;
  return `${m[1]!.toLowerCase() === "le" ? "au" : "aux"} ${m[2]}`;
}
