import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHomebrewSubclass, ensureSubclassFeatureEntry, resolveEntryBlocksInRuleset } from "./rules";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-181 — « Rendre jouable » une aptitude d'une sous-classe maison : la
 * fiche à briques `<sous-classe>-<aptitude>` naît dans la variante, une
 * seconde demande la retrouve, et la variante d'un autre reste fermée (la
 * RPC `upsert_ruleset_override` refuse). Variante et monde temporaires sur un
 * compte de test réutilisable, nettoyés à la fin (docs/TESTS.md).
 *
 * Contact réel à Supabase : se saute si .env.local n'est pas configuré.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("la fiche à briques d'une aptitude de sous-classe maison (intégration, base réelle)", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let outsiderClient: SupabaseClient;
  let userId: string;
  let variantRulesetId: string;
  let subclassKey: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const account = await getReusableTestAccount(admin, "owner");
    userId = account.id;
    userClient = account.client;
    outsiderClient = (await getReusableTestAccount(admin, "outsider")).client;

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .eq("base_system", "dnd_srd_52")
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel 2024 en base");

    const { data: variant, error: variantError } = await admin
      .from("rulesets")
      .insert({
        name: "Variante de test integration — aptitudes jouables",
        base_system: "dnd_srd_52",
        parent_ruleset_id: official.id,
        is_official_base: false,
        created_by: userId,
        content_origin: "personal_reference",
      })
      .select("id")
      .single();
    if (variantError || !variant) throw new Error(variantError?.message ?? "création de la variante échouée");
    variantRulesetId = variant.id;

    const created = await createHomebrewSubclass(userClient, {
      rulesetId: variantRulesetId,
      subclass: {
        name: `Collège de vérification ${Date.now()}`,
        parentClassKey: "bard",
        description: "",
        pageRef: "Test",
        features: [
          { name: "Magie envoûtante", level: 3, description: "Charmé ou Effrayé après un sort." },
          { name: "Majesté souveraine", level: 14, description: "" },
        ],
      },
    });
    if (!created.ok) throw new Error(`sous-classe non créée : ${created.reason}`);
    subclassKey = created.entryKey;
    variantRulesetId = created.rulesetId;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("worlds").delete().eq("owner_id", userId).eq("default_ruleset_id", variantRulesetId);
      await admin.from("rulesets").delete().eq("id", variantRulesetId);
    }
  });

  it("crée la fiche de l'aptitude sous la clé que lit le moteur, avec son texte, accents compris", async () => {
    const r = await ensureSubclassFeatureEntry(userClient, { rulesetId: variantRulesetId, subclassKey, featureIndex: 0 });
    expect(r).toMatchObject({ ok: true, created: true, entryKey: `${subclassKey}-magie-envoutante` });
    if (!r.ok) return;
    const fiche = await resolveEntryBlocksInRuleset(userClient, r.rulesetId, r.entryKey);
    expect(fiche?.entryType).toBe("feature");
    expect(fiche?.name).toBe("Magie envoûtante");
    expect(JSON.stringify(fiche?.blocksByType.get("description"))).toContain("Charmé ou Effrayé");
  });

  it("une seconde demande retrouve la même fiche, sans en créer une autre", async () => {
    const r = await ensureSubclassFeatureEntry(userClient, { rulesetId: variantRulesetId, subclassKey, featureIndex: 0 });
    expect(r).toMatchObject({ ok: true, created: false, entryKey: `${subclassKey}-magie-envoutante` });
  });

  it("un autre compte ne peut pas faire naître une fiche dans cette variante", async () => {
    const autre = await ensureSubclassFeatureEntry(outsiderClient, { rulesetId: variantRulesetId, subclassKey, featureIndex: 1 });
    expect(autre.ok).toBe(false);
    const fiche = await resolveEntryBlocksInRuleset(admin, variantRulesetId, `${subclassKey}-majeste-souveraine`);
    expect(fiche?.entryType).toBeUndefined();
  });

  it("une aptitude sans texte naît quand même ; une position hors du bloc est refusée", async () => {
    const r = await ensureSubclassFeatureEntry(userClient, { rulesetId: variantRulesetId, subclassKey, featureIndex: 1 });
    expect(r).toMatchObject({ ok: true, created: true, entryKey: `${subclassKey}-majeste-souveraine` });
    const hors = await ensureSubclassFeatureEntry(userClient, { rulesetId: variantRulesetId, subclassKey, featureIndex: 7 });
    expect(hors).toEqual({ ok: false, reason: "no_feature" });
  });

});
