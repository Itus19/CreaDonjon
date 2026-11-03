import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { pinRuleToNotebook } = await import("./notebookPin");
const { loadNotebookTree } = await import("./notebook");
const { getRuleEntryPageData, createHouseVersion, createRulesetVariant, getRuleEntryForWorld, getHomebrewEntryForEdit, replaceHomebrewEntry, resolveEntryBlocksInRuleset } = await import("./rules");

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
  let joueuse: ReusableAccount;
  let worldSlug: string;
  let worldId: string;
  let officialId: string;
  let variantId: string;
  const client = () => gm.client as unknown as SupabaseClient<Database>;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [gm, joueuse] = await Promise.all([getReusableTestAccount(admin, "gm"), getReusableTestAccount(admin, "player")]);
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).limit(1).single();
    officialId = official!.id;
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test version maison", slug: `integration-test-house-version-${Date.now()}`, owner_id: gm.id, default_ruleset_id: officialId })
      .select("id, slug")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    worldSlug = world.slug;
    const { data: campaign } = await admin.from("campaigns").insert({ world_id: worldId, name: "Campagne", ruleset_id: officialId, mode: "campaign", gm_user_id: gm.id }).select("id").single();
    await admin.from("campaign_members").insert([
      { campaign_id: campaign!.id, user_id: gm.id, role: "gm" },
      { campaign_id: campaign!.id, user_id: joueuse.id, role: "player" },
    ]);
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

  it("« Épingler au Bloc-notes » ajoute la règle au cahier privé, une seule fois", async () => {
    expect(await pinRuleToNotebook(client(), { worldId, userId: gm.id, ruleKey: "longsword" })).toEqual({ ok: true, alreadyPinned: false });
    expect(await pinRuleToNotebook(client(), { worldId, userId: gm.id, ruleKey: "longsword" })).toEqual({ ok: true, alreadyPinned: true });
    const { items } = await loadNotebookTree(client(), { worldId, userId: gm.id });
    expect(items.filter((i) => i.kind === "pinned_rule" && i.targetKey === "longsword")).toHaveLength(1);
  });

  it("V3.1-95 : la réponse servie à un joueur n'a ni données brutes, ni donnée officielle d'avant, ni marques du MJ ; le MJ les a", async () => {
    const mj = await getRuleEntryPageData(client(), worldSlug, "longsword", "fr");
    const joueur = await getRuleEntryPageData(joueuse.client as unknown as SupabaseClient<Database>, worldSlug, "longsword", "fr");
    expect(mj?.houseVersion).toBe(true);
    expect(mj?.blocks.some((b) => b.blockType === "custom_table")).toBe(true);
    expect(mj?.blocks.some((b) => b.originalData !== undefined)).toBe(true);

    expect(joueur?.tableRule).toBe(true);
    expect(joueur?.houseVersion).toBe(false);
    expect(joueur?.modifiedBlockTypes).toEqual([]);
    expect(joueur?.blocks.some((b) => b.blockType === "custom_table")).toBe(false);
    expect(JSON.stringify(joueur)).not.toMatch(/"originalData"/);
  });
});
