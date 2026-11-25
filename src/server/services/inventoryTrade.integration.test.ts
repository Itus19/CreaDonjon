import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { applyTrade, restoreInventory } from "./inventoryActions";
import { DEFAULT_CURRENCY_SYSTEM } from "@/src/core/rules/currency";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import { cleanupCreated } from "../testUtils/cleanupCreated";

/**
 * V3.2-8 — un échange réglé écrit UNE révision de l'inventaire ; un échange
 * court n'en écrit aucune ; l'annulation remet l'inventaire d'avant ; une
 * joueuse qui ne peut pas modifier la fiche est refusée.
 *
 * Coût (docs/QUOTAS.md T1-T2) : un monde, une fiche, un bloc, cinq gestes.
 * Se saute sans `.env.local`.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

const DEPART: InventoryBlockData = {
  __v: 1,
  items: [{ id: "corde", label: "Corde de chanvre", qty: 1 }],
  containers: [],
  currency: { pp: 0, gp: 1, ep: 0, sp: 0, cp: 0 },
};

describe.skipIf(!hasCreds)("échange réglé par le moteur (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let owner: { id: string; client: SupabaseClient };
  let player: { id: string; client: SupabaseClient };
  let worldId: string;
  let entityId: string;

  async function inventaire(): Promise<{ version: number; data: InventoryBlockData }> {
    const { data, error } = await admin.from("blocks").select("version, data").eq("entity_id", entityId).eq("block_type", "inventory").single();
    if (error || !data) throw new Error(error?.message ?? "inventaire introuvable");
    return data as { version: number; data: InventoryBlockData };
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    owner = await getReusableTestAccount(admin, "owner");
    player = await getReusableTestAccount(admin, "player");
    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — échange", slug: `test-echange-${Date.now()}`, owner_id: owner.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;
    await admin.from("world_members").insert({ world_id: worldId, user_id: player.id, role: "viewer" });
    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: `edran-${Date.now()}`, name: "Edran", entity_kind: "character", created_by: owner.id })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation fiche echouee");
    entityId = entity.id;
    const { error: blockError } = await admin.from("blocks").insert({
      entity_id: entityId,
      block_type: "inventory",
      display: { label: "Inventaire", layout: "inventory" },
      visibility_level: "public",
      created_by: owner.id,
      data: DEPART,
    });
    if (blockError) throw new Error(blockError.message);
  });

  afterAll(async () => {
    if (worldId) await cleanupCreated(admin, { worldIds: [worldId] });
  });

  it("refuse une joueuse qui ne peut pas modifier la fiche", async () => {
    const result = await applyTrade(player.client, {
      entityId,
      trade: { give: [{ kind: "coins", coin: "sp", amount: 5 }], receive: [] },
      actorUserId: player.id,
      system: DEFAULT_CURRENCY_SYSTEM,
    });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("un échange court n'écrit rien", async () => {
    const avant = await inventaire();
    const result = await applyTrade(owner.client, {
      entityId,
      trade: { give: [{ kind: "coins", coin: "gp", amount: 3 }], receive: [] },
      actorUserId: owner.id,
      system: DEFAULT_CURRENCY_SYSTEM,
    });
    expect(result).toEqual({ status: "short", missing: [{ kind: "coins", missingCp: 200 }] });
    expect((await inventaire()).version).toBe(avant.version);
  });

  it("un échange réglé écrit une révision, et l'annulation remet l'inventaire d'avant", async () => {
    const avant = await inventaire();
    const result = await applyTrade(owner.client, {
      entityId,
      trade: { give: [{ kind: "coins", coin: "sp", amount: 5 }, { kind: "item", itemId: "corde", qty: 1 }], receive: [{ kind: "item", item: { label: "Lanterne" }, qty: 1 }] },
      actorUserId: owner.id,
      system: DEFAULT_CURRENCY_SYSTEM,
    });
    expect("block" in result).toBe(true);
    const apres = await inventaire();
    expect(apres.version).toBe(avant.version + 1);
    expect(apres.data.currency.sp).toBe(5);
    expect(apres.data.items.map((i) => ("label" in i ? i.label : ""))).toEqual(["Lanterne"]);

    expect(await restoreInventory(owner.client, { entityId, before: avant.data, actorUserId: owner.id })).toBe(true);
    expect((await inventaire()).data).toEqual(avant.data);
  });
});
