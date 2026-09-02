import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRuleEntryForWorld, importRulesetEntries } from "./rules";
import { resolveBlockReferences } from "./referenceChips";
import type { BackgroundBlockData } from "@/src/core/schemas/rule-blocks";

/**
 * Bug reel trouve en verifiant en direct le formulaire "Créer un historique
 * personnalisé" : un historique maison dont le don reference une fiche
 * maison fraichement creee (meme import) affichait la CLE technique brute
 * ("HISTORIQUE-DE-VERIFICATION-QA-FEAT") au lieu du nom du don, alors que la
 * fiche du don elle-meme s'affiche correctement en la visitant directement.
 *
 * Cause : `findEntryInRulesetChain`/`listRulesetEntryChipsByKeys` ne lisent
 * que `ruleset_entries` (la base officielle/heritee) — une entree ajoutee
 * par une surcharge `add_entry` (V1-D4, aucune ligne `ruleset_entries`)
 * n'y apparait jamais. `resolveHomebrewEntryDisplay` (src/server/services/
 * rules.ts) comble ce trou pour les deux chemins de lecture concernes ici :
 * l'augmentation du bloc `background` (`feat_name`) et la resolution des
 * chips de reference (`<RuleChip>`, referenceChips.ts).
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que personalReferenceBadge.integration.test.ts).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("resolution d'une fiche maison referencee par une autre fiche maison (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let userId: string;
  let variantRulesetId: string;
  let world: { id: string; slug: string };
  const featKey = `historique-de-verification-qa-feat-${Date.now()}`;
  const backgroundKey = `historique-de-verification-qa-${Date.now()}`;
  const featName = "Don de vérification QA";
  const backgroundName = "Historique de vérification QA";

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-homebrew-ref-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = userData.user.id;

    userClient = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await userClient.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(signInError.message);

    const { data: official, error: officialError } = await admin
      .from("rulesets")
      .select("id")
      .eq("is_official_base", true)
      .eq("base_system", "dnd_srd_51")
      .limit(1)
      .single();
    if (officialError || !official) throw new Error(officialError?.message ?? "aucun ruleset officiel en base");

    const { data: variant, error: variantError } = await admin
      .from("rulesets")
      .insert({
        name: "Variante de test integration — reference maison",
        base_system: "dnd_srd_51",
        parent_ruleset_id: official.id,
        is_official_base: false,
        created_by: userId,
        content_origin: "user_created",
      })
      .select("id")
      .single();
    if (variantError || !variant) throw new Error(variantError?.message ?? "creation variante echouee");
    variantRulesetId = variant.id;

    const { data: worldRow, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — reference maison", slug: `test-homebrew-ref-${Date.now()}`, owner_id: userId, default_ruleset_id: variantRulesetId })
      .select("id, slug")
      .single();
    if (worldError || !worldRow) throw new Error(worldError?.message ?? "creation monde echouee");
    world = worldRow;

    // Meme mecanisme que le formulaire "Créer un historique personnalisé" :
    // deux fiches maison creees dans le MEME appel, l'historique referencant
    // le don par sa cle (specs/wiki-blocs.md §4.3, `zReference`).
    const importResult = await importRulesetEntries(userClient, {
      rulesetId: variantRulesetId,
      entries: [
        {
          entry_key: featKey,
          name: featName,
          entry_type: "feature",
          blocks: [{ block_type: "description", data: { segments: [{ text: "Un don cree pour verifier la resolution des references." }] } }],
        },
        {
          entry_key: backgroundKey,
          name: backgroundName,
          entry_type: "background",
          blocks: [
            {
              block_type: "background",
              data: {
                ability_scores: ["str", "dex", "con"],
                feat: { kind: "rule", key: featKey },
                skill_proficiencies: ["Perception"],
                equipment_options: [{ label: "Option A", items: [{ label: "Un objet", quantity: 1 }] }],
              } satisfies BackgroundBlockData,
            },
          ],
        },
      ],
    });
    if (importResult.errors.length > 0) {
      throw new Error(`import echoue : ${importResult.errors.map((e) => e.message).join("; ")}`);
    }
    // Le premier `add_entry`/`add_block` peut avoir forke un nouveau ruleset
    // (variante deja publiee) — l'id a utiliser pour toute lecture suivante
    // est celui que l'import a effectivement renvoye (meme piege documente
    // dans `importRulesetEntries`).
    variantRulesetId = importResult.rulesetId;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("worlds").delete().eq("owner_id", userId);
      await admin.from("rulesets").delete().eq("created_by", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("resout le nom reel du don maison dans le bloc background, pas sa cle technique", async () => {
    const entry = await getRuleEntryForWorld(admin, world.id, backgroundKey, "fr");
    expect(entry).not.toBeNull();
    const backgroundBlock = entry?.blocks.find((b) => b.blockType === "background");
    expect(backgroundBlock).toBeDefined();
    const data = backgroundBlock?.data as { feat_name?: string };
    expect(data.feat_name).toBe(featName);
    expect(data.feat_name).not.toBe(featKey);
  });

  it("resout le nom reel du don maison dans un chip de reference (<RuleChip>)", async () => {
    const chips = await resolveBlockReferences(admin, world, variantRulesetId, "fr", [{ kind: "rule", key: featKey }]);
    expect(chips).toHaveLength(1);
    expect(chips[0].found).toBe(true);
    expect(chips[0].name).toBe(featName);
    expect(chips[0].name).not.toBe(featKey);
  });
});
