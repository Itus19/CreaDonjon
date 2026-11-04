import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { savePlayableBlocks, listUnplayableRules } = await import("./rulePlayableBlocks");
const { createRulesetVariant, getRuleEntryForWorld, createHouseVersion } = await import("./rules");

/**
 * V3.1-132 — l'éditeur de briques enregistre dans la VARIANTE du monde, jamais
 * dans l'officielle (règle 18) ; la règle devient jouable, la vue « non
 * jouables » suit, et retirer le bloc la rend à son état. Monde et variante
 * jetables, comptes réutilisés (docs/TESTS.md).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const KEY = "paladin-abjure-foes";
const num = (value: number) => ({ op: "num" as const, value });
const ACTIVATION = {
  activations: [
    {
      id: "abjure",
      label: { fr: "Abjuration d'ennemis" },
      cost: { action: "magic", resources: [{ key: "channel-divinity", amount: num(1) }] },
      targets: { kind: "creature", range: { value: 18, unit: "m" } },
      effects: [
        { action: "saving_throw", who: "target", ability: "wis", dc: { op: "ref", name: "spell_save_dc" }, on_fail: [{ action: "apply_effect", who: "target", effect: "effraye" }] },
      ],
      variants: null,
      passages: { cost: "dépensez une utilisation de Conduit divin" },
    },
  ],
  durable_effects: [
    { id: "effraye", label: { fr: "Effrayé" }, conditions: ["frightened"], modifiers: [], duration: { unit: "minute", amount: 1 }, concentration: false, ends_on: [], token: null },
    // Orphelin : plus aucune brique ne le pose, il ne s'enregistre pas.
    { id: "orphelin", label: { fr: "Orphelin" }, conditions: [], modifiers: [], duration: { unit: "round", amount: 1 }, concentration: false, ends_on: [], token: null },
  ],
};

describe.skipIf(!hasCreds)("briques jouables d'une règle (V3.1-132, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let gm: ReusableAccount;
  let worldId: string;
  let officialId: string;
  let variantId: string;
  const client = () => gm.client as unknown as SupabaseClient<Database>;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    gm = await getReusableTestAccount(admin, "gm");
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).limit(1).single();
    officialId = official!.id;
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test briques", slug: `integration-test-briques-${Date.now()}`, owner_id: gm.id, default_ruleset_id: officialId })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (variantId) await admin.from("rulesets").delete().eq("id", variantId);
  });

  it("sur une base officielle : refusé (règle 18)", async () => {
    expect(await savePlayableBlocks(client(), { worldId, entryKey: KEY, blocks: { activation: ACTIVATION } })).toEqual({ ok: false, reason: "no_variant" });
  });

  it("dans une variante : la règle devient jouable, l'officielle ne bouge pas ; retirer le bloc la rend non évaluée", async () => {
    const variante = await createRulesetVariant(client(), { name: "Variante de test briques", parentRulesetId: officialId });
    variantId = variante!.id;
    await admin.from("worlds").update({ default_ruleset_id: variantId }).eq("id", worldId);

    const avant = await getRuleEntryForWorld(client(), worldId, KEY, "fr");
    expect(avant?.coverage?.state).toBe("unevaluated");
    expect((await listUnplayableRules(client(), { worldId, locale: "fr" }))?.some((r) => r.key === KEY)).toBe(true);

    expect(await savePlayableBlocks(client(), { worldId, entryKey: KEY, blocks: { activation: ACTIVATION } })).toEqual({ ok: true, rulesetId: variantId });
    const apres = await getRuleEntryForWorld(client(), worldId, KEY, "fr");
    expect(apres?.coverage).toEqual({ state: "playable", bricks: 5, cited: 1, gaps: 0 });
    const bloc = apres?.blocks.find((b) => b.blockType === "activation")?.data as { durable_effects: { id: string }[] };
    expect(bloc.durable_effects.map((e) => e.id)).toEqual(["effraye"]);
    expect((await listUnplayableRules(client(), { worldId, locale: "fr" }))?.some((r) => r.key === KEY)).toBe(false);

    // L'officielle : aucune surcharge écrite sur la base.
    const { count } = await admin.from("ruleset_overrides").select("id", { count: "exact", head: true }).eq("ruleset_id", officialId).eq("entry_key", KEY);
    expect(count).toBe(0);

    // Une lacune déclarée : partielle.
    await savePlayableBlocks(client(), { worldId, entryKey: KEY, blocks: { coverage: { gaps: [{ text: "voir à 18 m", missing: "distances réelles" }] } } });
    expect((await getRuleEntryForWorld(client(), worldId, KEY, "fr"))?.coverage?.state).toBe("partial");

    expect(await savePlayableBlocks(client(), { worldId, entryKey: KEY, blocks: { activation: null, coverage: null } })).toMatchObject({ ok: true });
    expect((await getRuleEntryForWorld(client(), worldId, KEY, "fr"))?.coverage?.state).toBe("unevaluated");
  });

  it("une version maison garde ses briques dans sa copie", async () => {
    expect(await createHouseVersion(client(), { worldId, entryKey: KEY, locale: "fr" })).toMatchObject({ ok: true });
    await savePlayableBlocks(client(), { worldId, entryKey: KEY, blocks: { activation: ACTIVATION } });
    const copie = await getRuleEntryForWorld(client(), worldId, KEY, "fr");
    expect(copie?.houseVersion).toBe(true);
    expect(copie?.coverage?.state).toBe("playable");
  });
});
