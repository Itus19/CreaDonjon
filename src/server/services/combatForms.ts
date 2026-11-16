import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { ResolvedEffect } from "@/src/core/rules/triggers";
import { zStatBlockBlockData } from "@/src/core/schemas/rule-blocks";
import { deleteCombatParticipant, insertSummonedParticipant, listCombatParticipants, updateCombatParticipant, type CombatParticipantRow, type CombatRow } from "@/src/server/repos/combats";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { applySignedEngineChange, readCombatParticipantsSigned, type EngineChangeLine } from "@/src/server/services/engineSigning";
import { getRuleEntryForWorld } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-183 (ADR 0078) — jouer les formes et les invocations qu'une activation
 * a résolues (le noyau les rend telles quelles, `transform` et `summon`).
 *
 * - Une forme se pose sur la ligne de combat (`form`), avec la règle qui la
 *   donne ; ses PV passent par l'effet `temp_hp` de la même activation.
 * - Une invocation ajoute des participants alliés, à côté de celle qui
 *   invoque, pilotés par la joueuse de son PJ.
 * Le MJ écrit directement ; une joueuse, par changement signé (la base revérifie
 * que celle qui invoque est son PJ). Hors combat, rien n'est posé : on le dit.
 *
 * Coût (QUOTAS) : la fiche de règle de la forme ou de la créature, une
 * écriture par ligne touchée.
 */
export async function playFormsAndSummons(
  supabase: TypedClient,
  params: {
    campaignId: string;
    combat: CombatRow | null;
    participants: readonly CombatParticipantRow[];
    effects: readonly ResolvedEffect[];
    casterEntityId: string;
    ruleKey: string;
    callerIsGm: boolean;
    worldId: string;
    locale: Locale;
  },
): Promise<string[]> {
  const jouees = params.effects.filter((e): e is Extract<ResolvedEffect, { action: "transform" | "summon" }> => e.action === "transform" || e.action === "summon");
  if (jouees.length === 0) return [];
  if (!params.combat) return ["Forme ou invocation : hors combat, rien n'est posé (le MJ la gère à la main)."];

  const ligneDe = (who: string) =>
    who.startsWith("participant:") ? params.participants.find((p) => p.id === who.slice("participant:".length)) : params.participants.find((p) => p.entity_id === who);
  const pjs = await listCampaignCharacters(supabase, params.campaignId);
  const phrases: string[] = [];
  const signes: EngineChangeLine[] = [];

  for (const e of jouees) {
    const ligne = ligneDe(e.who);
    if (!ligne) {
      phrases.push(`${e.action === "transform" ? "Forme" : "Invocation"} : ${e.who} n'est pas dans le combat.`);
      continue;
    }
    const cle = e.action === "transform" ? e.form : e.creature;
    const fiche = await getRuleEntryForWorld(supabase, params.worldId, cle, params.locale);
    if (!fiche) {
      phrases.push(`« ${cle} » est introuvable dans les règles du monde : rien n'est posé.`);
      continue;
    }
    if (e.action === "transform") {
      const forme = { rule_key: cle, mode: e.mode, label: fiche.name, source_rule_key: params.ruleKey };
      if (params.callerIsGm) await updateCombatParticipant(supabase, ligne.id, { form: forme as unknown as Json });
      else signes.push({ kind: "form", id: ligne.id, form: forme });
      phrases.push(`${ligne.label} prend la forme : ${fiche.name}.`);
      continue;
    }
    const stat = zStatBlockBlockData.safeParse(fiche.blocks.find((b) => b.blockType === "stat_block")?.data);
    const ca = stat.success ? stat.data.armor_class : null;
    const pv = stat.success ? stat.data.hit_points : null;
    const pilote = pjs.find((c) => c.entity_id === ligne.entity_id && c.is_pc)?.user_id ?? null;
    for (let i = 0; i < e.count; i++) {
      const nom = e.count > 1 ? `${fiche.name} ${i + 1}` : fiche.name;
      const id = randomUUID();
      if (params.callerIsGm) {
        await insertSummonedParticipant(supabase, { id, summoner: ligne, ruleKey: cle, label: nom, ac: ca, hpMax: pv, controlledBy: pilote, sourceRuleKey: params.ruleKey });
      } else {
        signes.push({ kind: "summon", id, summon: { summoner_id: ligne.id, rule_key: cle, label: nom, ac: ca, hp_max: pv, source_rule_key: params.ruleKey } });
      }
    }
    phrases.push(`${ligne.label} invoque ${e.count > 1 ? `${e.count} × ` : ""}${fiche.name}.`);
  }
  if (signes.length > 0) await applySignedEngineChange(supabase, { campaignId: params.campaignId, changes: signes });
  return phrases;
}

/**
 * V3.1-183 — un effet d'une règle prend fin sur une créature : la forme que
 * cette règle lui donnait tombe, et les créatures qu'elle avait invoquées par
 * cette règle quittent le combat.
 */
export async function endFormsAndSummons(
  supabase: TypedClient,
  params: { campaignId: string; combatId: string; bearerParticipantId: string; sourceRuleKey: string; callerIsGm: boolean },
): Promise<number> {
  const rows = params.callerIsGm
    ? await listCombatParticipants(supabase, params.combatId)
    : await readCombatParticipantsSigned(supabase, { campaignId: params.campaignId, combatId: params.combatId });
  const porteur = rows.find((r) => r.id === params.bearerParticipantId);
  const forme = porteur?.form && typeof porteur.form === "object" && !Array.isArray(porteur.form) ? (porteur.form as { source_rule_key?: unknown }) : null;
  const finForme = porteur && forme?.source_rule_key === params.sourceRuleKey;
  const invoquees = rows.filter((r) => r.summoned_by === params.bearerParticipantId && r.source_rule_key === params.sourceRuleKey);
  if (params.callerIsGm) {
    if (finForme) await updateCombatParticipant(supabase, porteur.id, { form: null });
    for (const r of invoquees) await deleteCombatParticipant(supabase, r.id);
  } else {
    const changes: EngineChangeLine[] = [...(finForme ? [{ kind: "form" as const, id: porteur.id, form: null }] : []), ...invoquees.map((r) => ({ kind: "unsummon" as const, id: r.id }))];
    if (changes.length > 0) await applySignedEngineChange(supabase, { campaignId: params.campaignId, changes });
  }
  return (finForme ? 1 : 0) + invoquees.length;
}
