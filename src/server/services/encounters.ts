import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  encounterBudget,
  formatChallengeRating,
  generateRandomEncounter,
  parseEncounterBudgetRows,
  type EncounterBudgetBand,
  type EncounterBudgetRow,
} from "@/src/core/rules/encounter";
import type { Rng } from "@/src/core/dice/rng";
import { getRulesetEntryByKey, listBlocksForRulesetEntry, listRulesetEntries, listTranslationsForEntries } from "@/src/server/repos/rules";
import { entryNameFrom } from "@/src/server/services/rules";
import { getCampaign } from "@/src/server/services/campaigns";
import {
  insertCampaignEncounter,
  listCampaignEncounters,
  type CampaignEncounterParticipant,
  type CampaignEncounterRow,
} from "@/src/server/repos/encounters";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/**
 * Table "Budget de PX par personnage" du ruleset (V1-E3, specs/outils-mj.md
 * §4.1) — lue depuis l'entree de regle `encounter-budget` (bloc
 * `custom_table`, ecrite par `scripts/write-encounter-budget-2024.ts`).
 * `null` si le ruleset n'a pas cette entree : c'est le cas normal pour le
 * SRD 5.1 (2014), qui ne republie pas cette table dans son contenu sous
 * licence libre — jamais une valeur inventee pour combler ce trou, l'appelant
 * doit afficher "budget non disponible" plutot qu'un chiffre invente.
 */
export async function getEncounterBudgetTable(
  supabase: TypedClient,
  rulesetId: string
): Promise<EncounterBudgetRow[] | null> {
  const entry = await getRulesetEntryByKey(supabase, rulesetId, "encounter-budget");
  if (!entry) return null;

  const blocks = await listBlocksForRulesetEntry(supabase, entry.id);
  const table = blocks.find((b) => b.block_type === "custom_table");
  if (!table) return null;

  const rows = (table.data as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  const parsed = parseEncounterBudgetRows(rows);
  return parsed.length > 0 ? parsed : null;
}

export interface EncounterMonsterSummary {
  key: string;
  name: string;
  challengeRating: number;
  challengeRatingLabel: string;
  xp: number;
  type: string;
  size: string;
}

/** Lit `xp`/`challenge_rating`/`type`/`size` de `source_raw` (forme SRD verifiee en base pour les deux editions) — `null` si l'un des deux champs numeriques manque, jamais un monstre a PX invente dans le catalogue. */
function monsterFieldsFrom(sourceRaw: unknown): { xp: number; challengeRating: number; type: string; size: string } | null {
  if (!sourceRaw || typeof sourceRaw !== "object") return null;
  const raw = sourceRaw as Record<string, unknown>;
  const xp = raw.xp;
  const cr = raw.challenge_rating;
  if (typeof xp !== "number" || typeof cr !== "number") return null;
  return {
    xp,
    challengeRating: cr,
    type: typeof raw.type === "string" ? raw.type : "",
    size: typeof raw.size === "string" ? raw.size : "",
  };
}

/**
 * Catalogue de monstres du ruleset (V1-E3, specs/outils-mj.md §4.2) — pour
 * le panneau de recherche/parcours de l'outil MJ « Générateur de
 * rencontres ». S'appuie sur `listRulesetEntries` (meme pagination que la
 * barre laterale de regles) filtre a `entry_type === "monster"`, jamais de
 * remontee de chaine de ruleset ici : contrairement aux personnages, une
 * rencontre se compose depuis le ruleset assigne au monde directement, pas
 * depuis une variante heritee — cf. AskUserQuestion tranchee par
 * l'utilisateur pour la table `campaign_encounters` (nouvelle table dediee,
 * pas de bloc d'entite).
 */
export async function listMonstersForRuleset(
  supabase: TypedClient,
  rulesetId: string,
  locale: Locale
): Promise<EncounterMonsterSummary[]> {
  const entries = await listRulesetEntries(supabase, rulesetId);
  const monsters = entries.filter((e) => e.entry_type === "monster");
  if (monsters.length === 0) return [];

  const translationByEntryId = new Map<string, string>();
  if (locale !== "en") {
    const translations = await listTranslationsForEntries(supabase, monsters.map((e) => e.id), locale);
    for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
  }

  const summaries: EncounterMonsterSummary[] = [];
  for (const entry of monsters) {
    const fields = monsterFieldsFrom(entry.source_raw);
    if (!fields) continue;
    summaries.push({
      key: entry.entry_key,
      name: translationByEntryId.get(entry.id) ?? entryNameFrom(entry),
      challengeRating: fields.challengeRating,
      challengeRatingLabel: formatChallengeRating(fields.challengeRating),
      xp: fields.xp,
      type: fields.type,
      size: fields.size,
    });
  }
  return summaries.sort((a, b) => a.challengeRating - b.challengeRating || a.name.localeCompare(b.name, "fr"));
}

/** "Mes combats" (V1-E3) : les rencontres sauvegardees d'une campagne, plus recentes d'abord. */
export async function listSavedEncounters(supabase: TypedClient, campaignId: string): Promise<CampaignEncounterRow[]> {
  return listCampaignEncounters(supabase, campaignId);
}

export async function saveEncounter(
  supabase: TypedClient,
  params: {
    campaignId: string;
    name: string;
    partySize: number;
    partyLevel: number;
    band: EncounterBudgetBand | null;
    participants: CampaignEncounterParticipant[];
    createdBy: string | null;
  }
): Promise<CampaignEncounterRow> {
  return insertCampaignEncounter(supabase, params);
}

export type GenerateEncounterResult =
  | { ok: true; budget: number; participants: CampaignEncounterParticipant[] }
  | { ok: false; reason: "campaign_not_found" | "budget_unavailable" };

/**
 * Solveur aleatoire pour une campagne (V1-E3, specs/outils-mj.md §4.3) :
 * compose le budget cote serveur depuis le ruleset EPINGLE de la campagne
 * (`campaigns.ruleset_id`, pas le ruleset par defaut du monde — une
 * campagne peut jouer une variante), pioche dans son catalogue de
 * monstres via `generateRandomEncounter` (noyau pur), puis reconstitue un
 * instantane pret a afficher/sauvegarder sans aller-retour supplementaire.
 */
export async function generateEncounterForCampaign(
  supabase: TypedClient,
  campaignId: string,
  params: { partySize: number; partyLevel: number; band: EncounterBudgetBand },
  locale: Locale,
  rng: Rng
): Promise<GenerateEncounterResult> {
  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { ok: false, reason: "campaign_not_found" };

  const budgetTable = await getEncounterBudgetTable(supabase, campaign.rulesetId);
  if (!budgetTable) return { ok: false, reason: "budget_unavailable" };

  const budget = encounterBudget(Array(params.partySize).fill(params.partyLevel), params.band, budgetTable);
  const monsters = await listMonstersForRuleset(supabase, campaign.rulesetId, locale);
  const monsterByKey = new Map(monsters.map((m) => [m.key, m]));

  const generated = generateRandomEncounter(
    budget,
    monsters.map((m) => ({ entryKey: m.key, xp: m.xp })),
    rng
  );

  const participants: CampaignEncounterParticipant[] = generated.flatMap(({ entryKey, count }) => {
    const monster = monsterByKey.get(entryKey);
    if (!monster) return [];
    return [{ entryKey, name: monster.name, challengeRatingLabel: monster.challengeRatingLabel, xp: monster.xp, count }];
  });

  return { ok: true, budget, participants };
}
