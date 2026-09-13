import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { entriesFromChainByKeys, type RulesetChainLink } from "./rules";

/**
 * V3-R7 (audit de performance) : `resolveOutgoingRefs`/`resolveEntryNames`
 * resolvaient leurs cles absentes du ruleset courant une par une, via
 * `findEntryInRulesetChain` en boucle sequentielle — mesure a 39 871
 * lectures unitaires par `pg_stat_statements`. `entriesFromChainByKeys`
 * remplace ce motif par une seule requete groupee sur toute la chaine.
 *
 * Le risque du changement : perdre l'ordre de priorite de la chaine
 * (`chain` feuille -> racine, la ligne du ruleset le PLUS specifique doit
 * gagner) — c'est ce qui fait qu'une variante surcharge correctement une
 * base officielle (regle absolue n° 18). Ce test verifie exactement ca :
 * une cle presente uniquement chez le parent, et une cle presente aux DEUX
 * niveaux, ou seule la version de l'enfant doit ressortir.
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que rules.homebrewReference.integration.test.ts).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("entriesFromChainByKeys — priorite de chaine (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let parentRulesetId: string;
  let childRulesetId: string;
  const sharedKey = `chaine-cle-partagee-${Date.now()}`;
  const parentOnlyKey = `chaine-cle-parent-seul-${Date.now()}`;
  const missingKey = `chaine-cle-absente-${Date.now()}`;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const { data: parent, error: parentError } = await admin
      .from("rulesets")
      .insert({ name: `Parent test priorite chaine ${Date.now()}`, base_system: "dnd_srd_51", is_official_base: false, content_origin: "user_created" })
      .select("id")
      .single();
    if (parentError || !parent) throw new Error(parentError?.message ?? "creation ruleset parent echouee");
    parentRulesetId = parent.id;

    const { data: child, error: childError } = await admin
      .from("rulesets")
      .insert({
        name: `Enfant test priorite chaine ${Date.now()}`,
        base_system: "dnd_srd_51",
        parent_ruleset_id: parentRulesetId,
        is_official_base: false,
        content_origin: "user_created",
      })
      .select("id")
      .single();
    if (childError || !child) throw new Error(childError?.message ?? "creation ruleset enfant echouee");
    childRulesetId = child.id;

    const { error: entriesError } = await admin.from("ruleset_entries").insert([
      { ruleset_id: parentRulesetId, entry_key: sharedKey, entry_type: "feature", source_raw: { name: "Version parent" } },
      { ruleset_id: parentRulesetId, entry_key: parentOnlyKey, entry_type: "feature", source_raw: { name: "Uniquement chez le parent" } },
      { ruleset_id: childRulesetId, entry_key: sharedKey, entry_type: "feature", source_raw: { name: "Version enfant" } },
    ]);
    if (entriesError) throw new Error(entriesError.message);
  });

  afterAll(async () => {
    if (parentRulesetId) {
      // L'enfant d'abord (FK `parent_ruleset_id`), les entrees suivent par cascade.
      await admin.from("rulesets").delete().eq("id", childRulesetId);
      await admin.from("rulesets").delete().eq("id", parentRulesetId);
    }
  });

  it("garde la version de l'enfant pour une cle surchargee, et retombe sur le parent pour une cle qui n'existe que chez lui", async () => {
    const chain: RulesetChainLink[] = [
      { rulesetId: childRulesetId, parentRulesetId, contentOrigin: "user_created" },
      { rulesetId: parentRulesetId, parentRulesetId: null, contentOrigin: "user_created" },
    ];

    const result = await entriesFromChainByKeys(admin, chain, [sharedKey, parentOnlyKey, missingKey]);

    expect(result.size).toBe(2);

    const shared = result.get(sharedKey);
    expect(shared?.ruleset_id).toBe(childRulesetId);
    expect((shared?.source_raw as { name?: string } | null)?.name).toBe("Version enfant");

    const parentOnly = result.get(parentOnlyKey);
    expect(parentOnly?.ruleset_id).toBe(parentRulesetId);
    expect((parentOnly?.source_raw as { name?: string } | null)?.name).toBe("Uniquement chez le parent");

    expect(result.has(missingKey)).toBe(false);
  });
});
