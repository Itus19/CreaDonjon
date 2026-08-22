import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { getEntityById } from "@/src/server/repos/entities";
import { listBlocksForEntity } from "@/src/server/repos/blocks";
import { resolveCharacterActionContext, getOrInitializeRuntimeState } from "@/src/server/services/characterActions";
import { getRuleEntryForWorld } from "@/src/server/services/rules";
import { listMonstersForRuleset, getEncounterBudgetTableForRuleset } from "@/src/server/services/encounters";
import { encounterBudget, generateRandomEncounter } from "@/src/core/rules/encounter";
import { resolveAttackRoll, resolveDamageRoll } from "@/src/core/rules/action";
import { formatFormulaNode } from "@/src/core/formula/format";
import { serverRng } from "@/src/server/services/rng";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { zActionsBlockData } from "@/src/core/schemas/rule-blocks/blocks";
import type { Segment } from "@/src/core/schemas/entities/segments";
import type { TextBlockData } from "@/src/core/schemas/blocks/text";
import { SPIKE_NPCS } from "@/src/core/ai/spikeSoloProposal";

type TypedClient = SupabaseClient<Database>;

/**
 * V2-S1 : identifiants fixes du monde fixture de `scripts/seed-dev.ts`
 * ("Bram le Tavernier", "L'Ancre Rouillee", campagne solo "Bram, une nuit
 * tranquille") — jamais le vrai monde de l'utilisateur, pour ne pas melanger
 * des donnees d'experience jetable a du contenu reel. Le spike ne fait
 * AUCUNE ecriture en base : PV et evenements se suivent cote client de
 * l'ecran, jamais persistes — un rechargement reset l'experience sans
 * toucher a la fixture partagee par d'autres tests.
 */
const SPIKE_WORLD_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SPIKE_CAMPAIGN_ID = "aaaaaaaa-0000-0000-0000-000000000006";
const SPIKE_LOCATION_ID = "aaaaaaaa-0000-0000-0000-00000000a001";
const SPIKE_CHARACTER_ID = "aaaaaaaa-0000-0000-0000-00000000b001";

/** Rien de reutilisable trouve dans le depot pour aplatir des segments en texte brut — 5 lignes, jetable (spike). */
function flattenSegmentsToText(segments: Segment[]): string {
  return segments.map((s) => s.content.map((n) => (n.t === "text" ? n.v : n.label)).join("")).join("\n");
}

export interface SpikeSetup {
  locationName: string;
  locationText: string;
  npcs: typeof SPIKE_NPCS;
  characterSummary: string;
  encounter: { monsterName: string; monsterEntryKey: string; count: number } | null;
}

export async function getSpikeSetup(supabase: TypedClient, locale: Locale): Promise<SpikeSetup> {
  const location = await getEntityById(supabase, SPIKE_LOCATION_ID);
  const locationBlocks = await listBlocksForEntity(supabase, SPIKE_LOCATION_ID);
  const textBlock = locationBlocks.find((b) => b.block_type === "text");
  const locationText = textBlock ? flattenSegmentsToText((textBlock.data as unknown as TextBlockData).segments) : "";

  const ctx = await resolveCharacterActionContext(supabase, SPIKE_CHARACTER_ID, SPIKE_CAMPAIGN_ID, locale);
  if (!ctx) throw new Error("Bram introuvable ou sans bloc character (fixture seed-dev manquante ?).");
  const runtime = await getOrInitializeRuntimeState(supabase, ctx);
  // Bram est un civil sans niveau de classe (hp_method fixed, classes: []) : hpMax derive a 0
  // (rien a deriver sans classe). PV actuels reste la seule valeur fiable a afficher ici.
  const characterSummary = `Bram : PV actuels ${runtime.state.hp.current}, CA ${ctx.sheet.ac.value}.`;

  // La campagne fixture pointe sa propre variante homebrew (aaaaaaaa-...-000000000004),
  // qui n'a par construction aucune entree "monster" a elle (listMonstersForRuleset,
  // V1-E3, ne remonte jamais la chaine de ruleset — decision produit deliberee, une
  // rencontre se compose depuis le ruleset assigne, pas une variante heritee). Pour ce
  // spike on interroge donc le ruleset par defaut DU MONDE (le socle officiel, catalogue
  // complet), pas celui de la campagne — seul le catalogue de monstres change, le moteur
  // de generation reste le meme (encounterBudget/generateRandomEncounter, V1-E3).
  const worldRulesetId = await getWorldDefaultRulesetId(supabase, SPIKE_WORLD_ID);
  const encounter = await (async () => {
    if (!worldRulesetId) return null;
    const budgetTable = await getEncounterBudgetTableForRuleset(supabase, worldRulesetId);
    const monsters = await listMonstersForRuleset(supabase, worldRulesetId, locale);
    if (!budgetTable || monsters.length === 0) return null;
    const budget = encounterBudget([1], "low", budgetTable.rows);
    const generated = generateRandomEncounter(budget, monsters.map((m) => ({ entryKey: m.key, xp: m.xp })), serverRng);
    const first = generated[0];
    if (!first) return null;
    const monster = monsters.find((m) => m.key === first.entryKey);
    return monster ? { monsterName: monster.name, monsterEntryKey: monster.key, count: first.count } : null;
  })();

  return {
    locationName: location?.name ?? "Lieu",
    locationText,
    npcs: SPIKE_NPCS,
    characterSummary,
    encounter,
  };
}

export interface MonsterAttackResult {
  fact: string;
  hit: boolean;
  damage: number;
}

/**
 * Resolution mecanique reelle (jamais par le modele, critere du spike) :
 * meme moteur que les boutons d'attaque de la fiche jouable
 * (`resolveAttackRoll`/`resolveDamageRoll`, `serverRng`) — seulement
 * applique a un monstre plutot qu'a un PJ, chemin qui n'existait pas encore
 * dans le depot (aucun wrapper monstre-vs-PJ avant ce spike).
 */
export async function resolveMonsterAttackOnBram(
  supabase: TypedClient,
  monsterEntryKey: string,
  locale: Locale
): Promise<MonsterAttackResult> {
  const entry = await getRuleEntryForWorld(supabase, SPIKE_WORLD_ID, monsterEntryKey, locale);
  if (!entry) throw new Error(`Monstre introuvable : ${monsterEntryKey}`);

  const actionsBlock = entry.blocks.find((b) => b.blockType === "actions");
  const parsedActions = actionsBlock ? zActionsBlockData.safeParse(actionsBlock.data) : null;
  const action = parsedActions?.success ? parsedActions.data.actions.find((a) => a.attack_bonus !== undefined && a.damage?.[0]) : undefined;
  if (!action || action.attack_bonus === undefined || !action.damage?.[0]) {
    throw new Error(`${entry.name} n'a pas d'action d'attaque exploitable (attack_bonus/damage).`);
  }

  const ctx = await resolveCharacterActionContext(supabase, SPIKE_CHARACTER_ID, SPIKE_CAMPAIGN_ID, locale);
  if (!ctx) throw new Error("Bram introuvable.");

  const attack = resolveAttackRoll(
    { abilityMod: 0, proficiencyBonus: action.attack_bonus, proficient: true, advantage: "normal" },
    serverRng
  );
  const ac = ctx.sheet.ac.value;
  if (attack.total < ac) {
    return { fact: `L'attaque de ${entry.name} (${attack.expression} = ${attack.total}) rate Bram (CA ${ac}).`, hit: false, damage: 0 };
  }
  const damage = resolveDamageRoll({ formula: formatFormulaNode(action.damage[0].dice), critical: attack.isCritical }, serverRng);
  return {
    fact: `L'attaque de ${entry.name} touche Bram (${attack.total} contre CA ${ac})${attack.isCritical ? " — critique" : ""} : ${damage.total} degats ${action.damage[0].type ?? ""}.`,
    hit: true,
    damage: damage.total,
  };
}
