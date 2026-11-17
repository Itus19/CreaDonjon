import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { DEFAULT_CURRENCY_SYSTEM } from "@/src/core/rules/currency";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";
import { cleanupCreated } from "../testUtils/cleanupCreated";

vi.mock("server-only", () => ({}));
const { readCurrencySystemForEntity, CURRENCY_ENTRY_KEY } = await import("./currencySystem");
const { changeCurrency } = await import("./inventoryActions");
const { upsertRulesetOverride } = await import("../repos/rules");

/**
 * V3.1-218 (ADR 0102) — le système monétaire lu par la chaîne de rulesets,
 * contre la vraie base. Le monde officiel garde le système du 13 octobre (le
 * bloc de la fiche « Pièces de monnaie » est le système par défaut) ; une
 * variante qui remplace le bloc par un système à couronne (pièce maison
 * courante de 5 po) dépense et rend la monnaie selon lui.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("système monétaire par la chaîne de rulesets (V3.1-218, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let owner: ReusableAccount;
  let officialId: string;
  let variantId: string | undefined;
  let worldId: string | undefined;
  let entityId: string;
  const client = () => owner.client as unknown as SupabaseClient<Database>;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    owner = await getReusableTestAccount(admin, "owner");
    const { data: official } = await admin.from("rulesets").select("id").eq("base_system", "dnd_srd_52").eq("is_official_base", true).single();
    officialId = official!.id;
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test monnaie", slug: `integration-test-monnaie-${Date.now()}`, owner_id: owner.id, default_ruleset_id: officialId })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "monde");
    worldId = world.id;
    const { data: e } = await admin.from("entities").insert({ world_id: worldId, slug: "bourse-218", name: "Bourse", entity_kind: "character", created_by: owner.id }).select("id").single();
    entityId = e!.id;
    await admin.from("blocks").insert({
      entity_id: entityId, block_type: "inventory", display: { label: "Inventaire", layout: "inventory" }, created_by: owner.id, visibility_level: "public",
      data: { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 7, ep: 0, sp: 0, cp: 0 } } as unknown as Json,
    });
  }, 120000);

  afterAll(async () => {
    await cleanupCreated(admin, { worldIds: [worldId], rulesetIds: [variantId] });
  });

  it("le monde officiel : le bloc SRD vaut le système par défaut ; or, argent, cuivre", async () => {
    expect(await readCurrencySystemForEntity(client(), { entityId, campaignId: null })).toEqual(DEFAULT_CURRENCY_SYSTEM);
    const system = await readCurrencySystemForEntity(client(), { entityId, campaignId: null });
    // Une couronne n'existe pas ici : refusée, rien n'est écrit.
    expect(await changeCurrency(client(), { entityId, delta: { crown: 1 }, actorUserId: owner.id, system })).toEqual({ error: "unknown_coin" });
    const r = await changeCurrency(client(), { entityId, delta: { gp: -2 }, actorUserId: owner.id, system });
    if ("error" in r) throw new Error(r.error);
    expect(r.block.data.currency).toEqual({ pp: 0, gp: 5, ep: 0, sp: 0, cp: 0 });
  }, 60000);

  it("une variante qui remplace le bloc par une couronne courante dépense et rend la monnaie selon elle", async () => {
    const { data: variant, error } = await admin
      .from("rulesets")
      .insert({ name: "Variante de test monnaie", base_system: "dnd_srd_52", parent_ruleset_id: officialId, is_official_base: false, created_by: owner.id, content_origin: "user_created" })
      .select("id")
      .single();
    if (error || !variant) throw new Error(error?.message ?? "variante");
    variantId = variant.id;
    const couronne = {
      coins: [...DEFAULT_CURRENCY_SYSTEM.coins, { key: "crown", label: { fr: "Couronne", en: "Crown" }, value_cp: 500, role: "common" as const }],
      break_order: DEFAULT_CURRENCY_SYSTEM.break_order,
    };
    variantId = await upsertRulesetOverride(client(), {
      rulesetId: variantId,
      entryKey: CURRENCY_ENTRY_KEY,
      blockType: "currency_system",
      action: "replace_block",
      payload: { block_type: "currency_system", display: { label: "Système monétaire", layout: "key_values" }, data: couronne, display_order: 300 } as unknown as Json,
      patch: null,
      note: null,
    });
    await admin.from("worlds").update({ default_ruleset_id: variantId }).eq("id", worldId!);

    const system = await readCurrencySystemForEntity(client(), { entityId, campaignId: null });
    expect(system.coins.map((c) => c.key)).toContain("crown");
    // 5 po + 1 couronne déposée : 1000 pc se regroupent en 2 couronnes.
    const depot = await changeCurrency(client(), { entityId, delta: { crown: 1 }, actorUserId: owner.id, system });
    if ("error" in depot) throw new Error(depot.error);
    expect(depot.block.data.currency).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, extra: { crown: 2 } });
    // Dépenser 3 po casse une couronne et rend la monnaie : 1 couronne + 2 po.
    const depense = await changeCurrency(client(), { entityId, delta: { gp: -3 }, actorUserId: owner.id, system });
    if ("error" in depense) throw new Error(depense.error);
    expect(depense.block.data.currency).toEqual({ pp: 0, gp: 2, ep: 0, sp: 0, cp: 0, extra: { crown: 1 } });
  }, 60000);
});
