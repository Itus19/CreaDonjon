import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { createHouseVersion, createRulesetVariant, getRuleEntryForWorld, getHomebrewEntryForEdit, replaceHomebrewEntry, resolveEntryBlocksInRuleset } = await import("./rules");

/**
 * V3.1-94 (ADR 0072) — « Créer une version maison » contre la base réelle :
 * la copie remplace l'officielle dans le monde (même clé), se modifie, et
 * la base officielle reste intacte. Monde et variante jetables.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("version maison d'une règle officielle (V3.1-94, integration, base reelle)", () => {
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
      .insert({ name: "Monde de test version maison", slug: `integration-test-house-version-${Date.now()}`, owner_id: gm.id, default_ruleset_id: officialId })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
    if (variantId) await admin.from("rulesets").delete().eq("id", variantId);
  });

  it("sur une base officielle : refusé, rien n'est écrit (règle 18)", async () => {
    expect(await createHouseVersion(client(), { worldId, entryKey: "longsword", locale: "fr" })).toEqual({ ok: false, reason: "no_variant" });
  });

  it("dans une variante : la copie remplace l'officielle sous la même clé, se modifie, et l'officielle ne bouge pas", async () => {
    const variante = await createRulesetVariant(client(), { name: "Variante de test version maison", parentRulesetId: officialId });
    variantId = variante!.id;
    await admin.from("worlds").update({ default_ruleset_id: variantId }).eq("id", worldId);

    const avant = await getRuleEntryForWorld(client(), worldId, "longsword", "fr");
    expect(avant?.houseVersion).toBe(false);
    expect(avant?.isOfficialBase).toBe(false);

    const cree = await createHouseVersion(client(), { worldId, entryKey: "longsword", locale: "fr" });
    expect(cree).toMatchObject({ ok: true, entryKey: "longsword" });
    // Une seconde fois : déjà une version maison.
    expect(await createHouseVersion(client(), { worldId, entryKey: "longsword", locale: "fr" })).toEqual({ ok: false, reason: "already" });

    const copie = await getRuleEntryForWorld(client(), worldId, "longsword", "fr");
    expect(copie?.houseVersion).toBe(true);
    expect(copie?.name).toBe(avant?.name);
    // Copie fraîche : rien ne diffère encore de l'officielle.
    expect(copie?.modifiedBlockTypes).toEqual([]);

    // « Modifier » : la copie se rouvre et se réécrit.
    const edition = await getHomebrewEntryForEdit(client(), { rulesetId: variantId, entryKey: "longsword" });
    expect(edition?.houseVersion).toBe(true);
    const arme = edition!.blocks.find((b) => b.blockType === "weapon")!.data as Record<string, unknown>;
    const remplace = await replaceHomebrewEntry(client(), {
      rulesetId: variantId,
      entryKey: "longsword",
      entry: {
        name: "Épée longue de la maison",
        entry_type: "weapon",
        blocks: edition!.blocks.map((b) =>
          b.blockType === "weapon" ? { block_type: "weapon", data: { ...arme, damage: { ...(arme.damage as object), dice: { op: "dice", count: 1, faces: 12 } } } } : { block_type: b.blockType, data: b.data }
        ) as never,
      },
    });
    expect(remplace).toMatchObject({ ok: true });

    const modifiee = await getRuleEntryForWorld(client(), worldId, "longsword", "fr");
    expect(modifiee?.name).toBe("Épée longue de la maison");
    expect(modifiee?.modifiedBlockTypes).toContain("weapon");
    // La mécanique lit aussi la version maison.
    const mecanique = await resolveEntryBlocksInRuleset(client(), variantId, "longsword");
    expect((mecanique?.blocksByType.get("weapon") as { damage: { dice: { faces: number } } }).damage.dice.faces).toBe(12);
    // L'officielle n'a pas bougé.
    const officielle = await resolveEntryBlocksInRuleset(client(), officialId, "longsword");
    expect((officielle?.blocksByType.get("weapon") as { damage: { dice: { faces: number } } }).damage.dice.faces).toBe(8);
  });
});
