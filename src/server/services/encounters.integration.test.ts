import { beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEncounterBudgetTable, getEncounterBudgetTableForRuleset, listMonstersForRuleset } from "./encounters";
import { getOfficialBaseRulesetId } from "@/src/server/repos/rules";

/**
 * V1-E3 : verifie que la table "Budget de PX par personnage" ecrite par
 * scripts/write-encounter-budget-2024.ts se relit correctement depuis la
 * base reelle, et que le SRD 5.1 (qui n'a pas cette table, voir le
 * commentaire du service) renvoie bien `null` plutot qu'une erreur ou une
 * valeur inventee. Contact reel a Supabase : se saute silencieusement si
 * .env.local n'est pas configure (meme pattern que les autres tests
 * d'integration).
 *
 * Les rulesets officiels sont resolus par `base_system` a chaque
 * `beforeAll`, jamais par UUID code en dur : l'UUID est genere a l'import
 * (`npm run ingest:srd`) et differe d'une base a l'autre — un UUID fige ici
 * ne visait que la production, et echouait silencieusement (entree
 * introuvable) sur toute base fraichement seedee (locale ou une autre
 * machine). Meme motif que `getOfficialBaseRulesetId` dans encounters.ts.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("getEncounterBudgetTable (integration, base reelle)", () => {
  // Construit dans `beforeAll`, jamais dans le corps du `describe` : Vitest
  // execute ce corps pour COLLECTER les tests meme quand `skipIf` est vrai,
  // et `createSupabaseClient("")` leve alors "supabaseUrl is required". La
  // suite entiere echouait donc sur toute machine sans .env.local, au lieu
  // de se sauter — meme motif que campaigns.integration.test.ts.
  let admin: SupabaseClient;
  let RULESET_5_1: string;
  let RULESET_5_2_1: string;
  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    RULESET_5_1 = (await getOfficialBaseRulesetId(admin, "dnd_srd_51"))!;
    RULESET_5_2_1 = (await getOfficialBaseRulesetId(admin, "dnd_srd_52"))!;
  });

  it("lit la table complete pour le SRD 5.2.1, valeurs conformes au texte officiel", async () => {
    const rows = await getEncounterBudgetTable(admin, RULESET_5_2_1);
    expect(rows).not.toBeNull();
    expect(rows).toHaveLength(20);
    expect(rows?.find((r) => r.level === 1)).toEqual({ level: 1, low: 50, moderate: 75, high: 100 });
    expect(rows?.find((r) => r.level === 20)).toEqual({ level: 20, low: 6400, moderate: 13200, high: 22000 });
  });

  it("renvoie null pour le SRD 5.1, qui ne republie pas cette table (jamais une valeur inventee)", async () => {
    const rows = await getEncounterBudgetTable(admin, RULESET_5_1);
    expect(rows).toBeNull();
  });
});

describe.skipIf(!hasCreds)("getEncounterBudgetTableForRuleset (integration, base reelle)", () => {
  // Construit dans `beforeAll`, jamais dans le corps du `describe` : Vitest
  // execute ce corps pour COLLECTER les tests meme quand `skipIf` est vrai,
  // et `createSupabaseClient("")` leve alors "supabaseUrl is required". La
  // suite entiere echouait donc sur toute machine sans .env.local, au lieu
  // de se sauter — meme motif que campaigns.integration.test.ts.
  let admin: SupabaseClient;
  let RULESET_5_1: string;
  let RULESET_5_2_1: string;
  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    RULESET_5_1 = (await getOfficialBaseRulesetId(admin, "dnd_srd_51"))!;
    RULESET_5_2_1 = (await getOfficialBaseRulesetId(admin, "dnd_srd_52"))!;
  });

  it("le SRD 5.2.1 n'a pas besoin de repli : ses propres lignes, isFallback a false", async () => {
    const resolution = await getEncounterBudgetTableForRuleset(admin, RULESET_5_2_1);
    expect(resolution?.isFallback).toBe(false);
    expect(resolution?.rows).toHaveLength(20);
  });

  it("le SRD 5.1 replie sur le SRD 2024 officiel, isFallback a true, memes valeurs que 5.2.1 (retour utilisateur : outil disponible quel que soit le ruleset)", async () => {
    const resolution = await getEncounterBudgetTableForRuleset(admin, RULESET_5_1);
    expect(resolution?.isFallback).toBe(true);
    expect(resolution?.rows.find((r) => r.level === 1)).toEqual({ level: 1, low: 50, moderate: 75, high: 100 });
  });
});

describe.skipIf(!hasCreds)("listMonstersForRuleset (integration, base reelle)", () => {
  // Construit dans `beforeAll`, jamais dans le corps du `describe` : Vitest
  // execute ce corps pour COLLECTER les tests meme quand `skipIf` est vrai,
  // et `createSupabaseClient("")` leve alors "supabaseUrl is required". La
  // suite entiere echouait donc sur toute machine sans .env.local, au lieu
  // de se sauter — meme motif que campaigns.integration.test.ts.
  let admin: SupabaseClient;
  let RULESET_5_2_1: string;
  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    RULESET_5_2_1 = (await getOfficialBaseRulesetId(admin, "dnd_srd_52"))!;
  });

  it("retrouve le gobelin-guerrier du SRD 5.2.1 avec ses PX et son FP", async () => {
    const monsters = await listMonstersForRuleset(admin, RULESET_5_2_1, "fr");
    const goblin = monsters.find((m) => m.key === "goblin-warrior");
    expect(goblin).toBeDefined();
    expect(goblin?.xp).toBe(50);
    expect(goblin?.challengeRatingLabel).toBe("1/4");
  });
});
