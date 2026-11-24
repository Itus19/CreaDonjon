import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { CampaignTableSettings } from "@/src/core/campaigns/tableSettings";
import { getEntityById } from "@/src/server/repos/entities";
import { listCampaignCharacters, listCampaignsForWorld } from "@/src/server/repos/campaigns";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { getRulesetCopyInfo, listOverrideDigests, type SelectableRulesetRow } from "@/src/server/repos/rules";
import { lireReference, miseAJourCopie, type RegleAMettreAJour } from "@/src/core/rules/copieRuleset";
import { listSelectableRulesetsForCurrentUser } from "@/src/server/services/rules";
import { listVisibleBlocks, type VisibleBlock } from "@/src/server/services/blocks";
import { readTableSettings } from "@/src/server/services/tableSettings";

type TypedClient = SupabaseClient<Database>;

/** Tout ce que l'écran Règles actives montre à sa première vue (V3.1-57, docs/CABLAGE.md C1). */
export interface ReglesActivesData {
  /** Les officiels et les variantes de l'appelant, avec leur parent (l'arbre). */
  options: SelectableRulesetRow[];
  current: string | null;
  /** La campagne du monde et ses interrupteurs ; `null` sans campagne. */
  campaign: { id: string; tableSettings: CampaignTableSettings } | null;
  /** Le PJ dont la fiche sert d'aperçu (une joueuse de préférence) et ses blocs ; `null` sans PJ. */
  apercu: { entityId: string; entityName: string; blocks: VisibleBlock[] } | null;
  /** AG-18 : le ruleset actif est une copie dont la source a changé ; `null` sinon. */
  miseAJour: MiseAJourRuleset | null;
}

export interface MiseAJourRuleset {
  copieId: string;
  sourceNom: string;
  regles: RegleAMettreAJour[];
}

/**
 * AG-18 (ADR 0106) — ce qui a changé dans la source de la copie active. Deux
 * lectures (la référence de la copie, l'empreinte de chaque règle de la
 * source), seulement quand le ruleset actif est une copie de l'appelant.
 * `null` sans changement : l'écran ne montre rien.
 */
async function chargerMiseAJour(supabase: TypedClient, options: SelectableRulesetRow[], current: string | null): Promise<MiseAJourRuleset | null> {
  const actif = options.find((o) => o.id === current);
  const source = actif?.copied_from_ruleset_id ? options.find((o) => o.id === actif.copied_from_ruleset_id) : undefined;
  if (!actif || !source) return null;
  const [info, empreintes] = await Promise.all([getRulesetCopyInfo(supabase, actif.id), listOverrideDigests(supabase, source.id)]);
  if (!info) return null;
  const regles = miseAJourCopie(lireReference(info.baseline), empreintes);
  return regles.length > 0 ? { copieId: actif.id, sourceNom: source.name, regles } : null;
}

/**
 * V3.1-57 — l'écran Règles actives du MJ, page et fenêtre : les rulesets,
 * celui qui est actif, les interrupteurs de la campagne et un PJ pour
 * l'aperçu de la fiche. Le PJ choisi est le premier tenu par une joueuse
 * (sinon le premier PJ) ; ses blocs passent par le même filtre de
 * visibilité que la fiche.
 */
export async function chargerReglesActives(
  supabase: TypedClient,
  world: { id: string },
  userId: string
): Promise<ReglesActivesData> {
  const [options, current, campaigns] = await Promise.all([
    listSelectableRulesetsForCurrentUser(supabase),
    getWorldDefaultRulesetId(supabase, world.id),
    listCampaignsForWorld(supabase, world.id),
  ]);
  const campaignRow = campaigns[0] ?? null;
  const miseAJourPromise = chargerMiseAJour(supabase, options ?? [], current);
  if (!campaignRow) return { options: options ?? [], current, campaign: null, apercu: null, miseAJour: await miseAJourPromise };

  const [settings, characters, miseAJour] = await Promise.all([
    readTableSettings(supabase, campaignRow.id),
    listCampaignCharacters(supabase, campaignRow.id),
    miseAJourPromise,
  ]);
  const pcs = characters.filter((c) => c.is_pc);
  const choisi = pcs.find((c) => c.user_id !== null) ?? pcs[0] ?? null;
  const [entity, blocks] = choisi
    ? await Promise.all([getEntityById(supabase, choisi.entity_id), listVisibleBlocks(supabase, world.id, choisi.entity_id, userId)])
    : [null, []];

  return {
    options: options ?? [],
    current,
    campaign: settings === "not_found" ? null : { id: campaignRow.id, tableSettings: settings },
    apercu: entity ? { entityId: entity.id, entityName: entity.name, blocks } : null,
    miseAJour,
  };
}
