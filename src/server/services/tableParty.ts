import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import type { Currency } from "@/src/core/rules/currency";
import type { RechargeKind } from "@/src/core/rules/resourceRecharge";
import { evaluate } from "@/src/core/formula/evaluate";
import { resolveCharacterActionContext, getOrInitializeRuntimeState, type RuntimeStateView } from "@/src/server/services/characterActions";
import { listWorldPlayerCharacters } from "@/src/server/services/worldPlayerCharacters";
import { getDisplayNamesForUsers } from "@/src/server/repos/activityJournal";

type TypedClient = SupabaseClient<Database>;

/** Un compteur « Ce qui se dépense » : la valeur stockée est le nombre d'utilisations CONSOMMÉES (ADR 0045). */
export interface TableResource {
  id: string;
  label: string;
  recharge: RechargeKind;
  max: number;
  used: number;
}

/**
 * Un PJ de l'outil Table (V3.1-34) : exactement ce que la fiche tire du
 * serveur (`/sheet` : fiche calculée et état de jeu), plus l'identité de la
 * ligne repliée, les compteurs et la bourse. Rien n'est calculé côté client
 * (règle 16 : la CA, la vitesse, la Perception passive viennent d'ici).
 */
export interface TablePc {
  entityId: string;
  entitySlug: string;
  name: string;
  playerName: string | null;
  speciesLabel: string | null;
  classesLabel: string | null;
  level: number;
  sheet: DerivedSheet;
  hitDiceTotals: Record<string, number>;
  runtimeState: RuntimeStateView;
  resources: TableResource[];
  currency: Currency;
}

const NEVER_ROLLS = {
  nextInt: (): number => {
    throw new Error("le mode max n'appelle jamais le RNG");
  },
};

/** Même calcul que l'onglet Actions de la fiche (`ActionsTab.resourceMax`) : le maximum d'un compteur, sans dé. */
function resourceMax(formula: Parameters<typeof evaluate>[0]): number {
  try {
    return evaluate(formula, {}, NEVER_ROLLS, "max").value;
  } catch (erreur) {
    console.error("Formule de maximum de ressource illisible", erreur);
    return 0;
  }
}

/**
 * Toute la table d'un coup (V3.1-34) : les PJ de la campagne, chacun résolu
 * comme sa fiche. Réservé au MJ par l'appelant (route des fenêtres d'outil) :
 * l'état de jeu d'un PJ qui n'en a pas encore est initialisé, comme la fiche
 * le fait pour qui peut la modifier.
 */
export async function getTableParty(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; locale: Locale }
): Promise<TablePc[]> {
  const pcs = await listWorldPlayerCharacters(supabase, params.worldId, params.locale);
  const names = await getDisplayNamesForUsers(
    supabase,
    pcs.map((pc) => pc.claimedByUserId).filter((id): id is string => id !== null)
  );

  const table: TablePc[] = [];
  // Un PJ après l'autre, comme `getPartySkillProbabilities` : chaque résolution
  // lit le ruleset de la campagne, mis en cache par requête.
  for (const pc of pcs) {
    const ctx = await resolveCharacterActionContext(supabase, pc.entityId, params.campaignId, params.locale);
    if (!ctx) continue;
    const runtimeState = await getOrInitializeRuntimeState(supabase, ctx, { persist: true });
    const used = runtimeState.state.resources;
    table.push({
      entityId: pc.entityId,
      entitySlug: pc.entitySlug,
      name: pc.entityName,
      playerName: pc.claimedByUserId ? names.get(pc.claimedByUserId) || null : null,
      speciesLabel: pc.speciesLabel,
      classesLabel: pc.classesLabel,
      level: Math.max(1, ctx.characterData.classes.reduce((sum, c) => sum + c.level, 0)),
      sheet: ctx.sheet,
      hitDiceTotals: ctx.hitDiceTotals,
      runtimeState,
      resources: (ctx.resourcesData?.trackers ?? []).map((t) => ({
        id: t.id,
        label: t.label,
        recharge: t.recharge,
        max: resourceMax(t.max.formula),
        used: used[t.id] ?? 0,
      })),
      currency: ctx.inventoryData?.currency ?? { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    });
  }
  return table;
}
