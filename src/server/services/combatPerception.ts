import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Point } from "@/src/core/rules/geometry";
import { attackSight, canSee, perceptionConditions, sensesFromStatBlock, type LightSource, type Lighting, type Perceiver, type PerceptionWorld, type Sight } from "@/src/core/rules/perception";
import { zStatBlockBlockData } from "@/src/core/schemas/rule-blocks";
import { zStatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import type { CombatParticipantRow, CombatRow } from "@/src/server/repos/combats";
import { getCombatById, listCombatParticipants, updateCombat, updateCombatParticipant } from "@/src/server/repos/combats";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { resolveCharacterActionContext, type CharacterActionContext } from "@/src/server/services/characterActions";
import { applySignedEngineChange, readCombatParticipantsSigned } from "@/src/server/services/engineSigning";
import { getRuleEntryForWorld } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-181 (ADR 0078) — la perception en combat, côté serveur : qui voit qui
 * d'après le noyau (`perception.ts`), le masquage des joueuses (drapeau
 * d'accès `hidden_from_players`), et ce que la vue fait à une attaque.
 *
 * Coût (QUOTAS) : rien du tout tant que le combat est en plein jour et que
 * personne n'est Aveuglé, Invisible ni Caché (le cas courant). Sinon, une
 * fiche par PJ du combat et, pour une attaque, le bloc de stats d'un monstre.
 */

const ETATS_QUI_COMPTENT = ["blinded", "invisible", "hidden"];

const posOf = (p: CombatParticipantRow): Point | null => (p.pos_x !== null && p.pos_y !== null ? { x: Number(p.pos_x), y: Number(p.pos_y) } : null);
const conditionsOf = (p: CombatParticipantRow) =>
  perceptionConditions(Array.isArray(p.conditions) ? p.conditions.filter((c): c is string => typeof c === "string") : []);

export function lightingOf(combat: Pick<CombatRow, "lighting">): Lighting {
  return combat.lighting === "dim" || combat.lighting === "dark" ? combat.lighting : "bright";
}

/** Le cas courant : rien ne gêne la vue, aucune fiche à lire. */
export function perceptionIsTrivial(combat: Pick<CombatRow, "lighting">, rows: readonly CombatParticipantRow[]): boolean {
  return lightingOf(combat) === "bright" && !rows.some((r) => conditionsOf(r).some((c) => ETATS_QUI_COMPTENT.includes(c)));
}

/** Un PJ vu par le moteur : ses sens et sa lumière viennent de sa fiche ; sa Perception passive aussi. */
function perceiverFromSheet(row: CombatParticipantRow, ctx: CharacterActionContext): { who: Perceiver; passive: number; light: LightSource | null } {
  const senses: Perceiver["senses"] = {};
  for (const [k, v] of Object.entries(ctx.sheet.senses)) if (v && v.value > 0) senses[k as keyof Perceiver["senses"]] = v.value;
  const pos = posOf(row);
  return {
    who: { id: row.id, pos, conditions: conditionsOf(row), senses, hiddenTotal: row.stealth_total },
    passive: ctx.sheet.passives.perception.value,
    light: pos && ctx.sheet.light ? { pos, bright: ctx.sheet.light.bright, dim: ctx.sheet.light.dim } : null,
  };
}

/** Une créature vue par le moteur : ses sens lus dans son bloc de stats (règle ou wiki) ; sans bloc, aucun sens. */
async function perceiverFromStatBlock(supabase: TypedClient, row: CombatParticipantRow, worldId: string, locale: Locale): Promise<{ who: Perceiver; passive: number | null }> {
  let lus: ReturnType<typeof sensesFromStatBlock> = { senses: {}, passivePerception: null };
  if (row.rule_key) {
    const entry = await getRuleEntryForWorld(supabase, worldId, row.rule_key, locale);
    const stat = zStatBlockBlockData.safeParse(entry?.blocks.find((b) => b.blockType === "stat_block")?.data);
    if (stat.success) lus = sensesFromStatBlock(stat.data.senses);
  } else if (row.source_kind === "entity" && row.entity_id) {
    const [bloc] = await listBlocksByTypeForEntities(supabase, [row.entity_id], "statblock");
    const lu = bloc ? zStatblockBlockData.safeParse(bloc.data) : null;
    if (lu?.success) lus = sensesFromStatBlock(lu.data.senses);
  }
  return { who: { id: row.id, pos: posOf(row), conditions: conditionsOf(row), senses: lus.senses, hiddenTotal: row.stealth_total }, passive: lus.passivePerception };
}

/**
 * Recalculer le masquage des joueuses : un adversaire est masqué quand aucun
 * PJ du combat ne le voit (Perception passive contre un Caché). Écrit seulement
 * les lignes qui changent : le MJ directement, une joueuse par changement
 * signé (elle n'écrit pas les lignes des autres). Rend le nombre de lignes changées.
 */
export async function recomputeMasking(
  supabase: TypedClient,
  params: { campaignId: string; combat: CombatRow; callerIsGm: boolean; locale: Locale; rows?: CombatParticipantRow[] },
): Promise<number> {
  const rows = params.rows ?? (params.callerIsGm ? await listCombatParticipants(supabase, params.combat.id) : await readCombatParticipantsSigned(supabase, { campaignId: params.campaignId, combatId: params.combat.id }));
  const pcIds = new Set((await listCampaignCharacters(supabase, params.campaignId)).filter((c) => c.is_pc).map((c) => c.entity_id));
  const estPj = (r: CombatParticipantRow) => r.entity_id !== null && pcIds.has(r.entity_id);
  const adversaires = rows.filter((r) => !r.is_ally && !estPj(r));
  const pjs = rows.filter(estPj);

  let voulu: Map<string, boolean>;
  if (perceptionIsTrivial(params.combat, rows) || pjs.length === 0) {
    voulu = new Map(adversaires.map((r) => [r.id, false]));
  } else {
    const fiches = await Promise.all(pjs.map((r) => resolveCharacterActionContext(supabase, r.entity_id!, params.campaignId, params.locale)));
    const vus = pjs.flatMap((r, i) => (fiches[i] ? [perceiverFromSheet(r, fiches[i]!)] : []));
    const monde: PerceptionWorld = {
      ambient: lightingOf(params.combat),
      sources: vus.flatMap((v) => (v.light ? [v.light] : [])),
      planned: rows.filter((r) => posOf(r) !== null).length >= 2,
    };
    voulu = new Map(
      adversaires.map((r) => {
        const cible: Perceiver = { id: r.id, pos: posOf(r), conditions: conditionsOf(r), senses: {}, hiddenTotal: r.stealth_total };
        return [r.id, !vus.some((v) => canSee(v.who, cible, monde, { perception: v.passive }) !== "unseen")];
      }),
    );
  }

  const changements = adversaires.filter((r) => voulu.get(r.id) !== r.hidden_from_players);
  if (changements.length === 0) return 0;
  if (params.callerIsGm) {
    for (const r of changements) await updateCombatParticipant(supabase, r.id, { hiddenFromPlayers: voulu.get(r.id)! });
  } else {
    await applySignedEngineChange(supabase, {
      campaignId: params.campaignId,
      changes: changements.map((r) => ({ kind: "perception" as const, id: r.id, perception: { hidden_from_players: voulu.get(r.id)! } })),
    });
  }
  return changements.length;
}

/**
 * Ce que la vue fait à une attaque de `attaquant` sur `cible` : `normal` dans
 * le cas courant (aucune lecture). Les fiches déjà chargées sont réutilisées.
 */
export async function attackSightFor(
  supabase: TypedClient,
  params: {
    combat: CombatRow;
    rows: readonly CombatParticipantRow[];
    attacker: CombatParticipantRow;
    target: CombatParticipantRow;
    campaignId: string;
    worldId: string;
    locale: Locale;
    pcEntityIds: ReadonlySet<string>;
    loaded?: readonly CharacterActionContext[];
  },
): Promise<{ sight: "advantage" | "disadvantage" | "normal"; attackerSees: Sight; targetSees: Sight }> {
  if (perceptionIsTrivial(params.combat, [params.attacker, params.target])) return { sight: "normal", attackerSees: "clear", targetSees: "clear" };
  const vu = async (r: CombatParticipantRow) => {
    if (r.entity_id && params.pcEntityIds.has(r.entity_id)) {
      const ctx = params.loaded?.find((c) => c.entityId === r.entity_id) ?? (await resolveCharacterActionContext(supabase, r.entity_id, params.campaignId, params.locale));
      if (ctx) return perceiverFromSheet(r, ctx);
    }
    const s = await perceiverFromStatBlock(supabase, r, params.worldId, params.locale);
    return { who: s.who, passive: s.passive ?? 10, light: null };
  };
  const [a, t] = await Promise.all([vu(params.attacker), vu(params.target)]);
  const monde: PerceptionWorld = {
    ambient: lightingOf(params.combat),
    sources: [a.light, t.light].flatMap((l) => (l ? [l] : [])),
    planned: params.rows.filter((r) => posOf(r) !== null).length >= 2,
  };
  const attackerSees = canSee(a.who, t.who, monde, { perception: a.passive });
  const targetSees = canSee(t.who, a.who, monde, { perception: t.passive });
  return { sight: attackSight({ attackerSeesTarget: attackerSees, targetSeesAttacker: targetSees }), attackerSees, targetSees };
}

/**
 * Le MJ règle la lumière ambiante ; le masquage des joueuses est aussitôt
 * recalculé. (Pas de journal : ce n'est pas un coup de la partie, et « Annuler »
 * ne défait que les coups.)
 */
export async function setCombatLighting(
  supabase: TypedClient,
  params: { campaignId: string; combatId: string; lighting: Lighting; actorUserId: string; locale: Locale },
): Promise<CombatRow | null> {
  const avant = await getCombatById(supabase, params.combatId);
  if (!avant || avant.campaign_id !== params.campaignId) return null;
  const apres = await updateCombat(supabase, params.combatId, { lighting: params.lighting });
  await recomputeMasking(supabase, { campaignId: params.campaignId, combat: apres, callerIsGm: true, locale: params.locale });
  return apres;
}

/** Après une écriture du moteur : ne recalcule que si un état qui compte pour la vue a changé. */
export function touchesPerception(conditionKeys: readonly string[]): boolean {
  return perceptionConditions(conditionKeys).some((c) => ETATS_QUI_COMPTENT.includes(c));
}
