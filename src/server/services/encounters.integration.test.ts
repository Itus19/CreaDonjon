import { describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEncounterBudgetTable, listMonstersForRuleset } from "./encounters";

/**
 * V1-E3 : verifie que la table "Budget de PX par personnage" ecrite par
 * scripts/write-encounter-budget-2024.ts se relit correctement depuis la
 * base reelle, et que le SRD 5.1 (qui n'a pas cette table, voir le
 * commentaire du service) renvoie bien `null` plutot qu'une erreur ou une
 * valeur inventee. Contact reel a Supabase : se saute silencieusement si
 * .env.local n'est pas configure (meme pattern que les autres tests
 * d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const RULESET_5_1 = "41ebff94-aabc-4f5c-b437-28f2f7a195ee";
const RULESET_5_2_1 = "110d20e9-dd80-4752-a57e-a957601b4eae";

describe.skipIf(!hasCreds)("getEncounterBudgetTable (integration, base reelle)", () => {
  const admin: SupabaseClient = createSupabaseClient(SUPABASE_URL ?? "", SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false },
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

describe.skipIf(!hasCreds)("listMonstersForRuleset (integration, base reelle)", () => {
  const admin: SupabaseClient = createSupabaseClient(SUPABASE_URL ?? "", SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false },
  });

  it("retrouve le gobelin-guerrier du SRD 5.2.1 avec ses PX et son FP", async () => {
    const monsters = await listMonstersForRuleset(admin, RULESET_5_2_1, "fr");
    const goblin = monsters.find((m) => m.key === "goblin-warrior");
    expect(goblin).toBeDefined();
    expect(goblin?.xp).toBe(50);
    expect(goblin?.challengeRatingLabel).toBe("1/4");
  });
});
