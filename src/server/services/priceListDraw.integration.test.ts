import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { drawPriceListForBlock } from "./priceListDraw";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import { cleanupCreated } from "../testUtils/cleanupCreated";

/**
 * V3.2-9 — « Tirer la carte » : la porte du tirage (docs/SECURITE.md §2).
 * Une joueuse qui VOIT le bloc mais ne peut pas modifier la fiche est
 * refusée ; un compte hors du monde ne trouve rien ; la propriétaire passe
 * la porte et reçoit le motif honnête d'un monde sans générateurs.
 *
 * Coût (docs/QUOTAS.md T1-T2) : un monde, une fiche, un bloc, trois tirages.
 * Se saute sans `.env.local`.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("tirage de la carte d'un lieu (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let owner: { id: string; client: SupabaseClient };
  let player: { id: string; client: SupabaseClient };
  let outsider: { id: string; client: SupabaseClient };
  let worldId: string;
  let blockId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    owner = await getReusableTestAccount(admin, "owner");
    player = await getReusableTestAccount(admin, "player");
    outsider = await getReusableTestAccount(admin, "outsider");

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — carte", slug: `test-carte-${Date.now()}`, owner_id: owner.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;
    const { error: memberError } = await admin.from("world_members").insert({ world_id: worldId, user_id: player.id, role: "viewer" });
    if (memberError) throw new Error(memberError.message);

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: `fanal-${Date.now()}`, name: "Le Fanal", entity_kind: "location", created_by: owner.id })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation fiche echouee");
    const { data: block, error: blockError } = await admin
      .from("blocks")
      .insert({
        entity_id: entity.id,
        block_type: "price_list",
        display: { label: "Carte et tarifs", layout: "table" },
        visibility_level: "public",
        created_by: owner.id,
        data: { __v: 1, wealth: null, seed: null, offers: [] },
      })
      .select("id")
      .single();
    if (blockError || !block) throw new Error(blockError?.message ?? "creation bloc echouee");
    blockId = block.id;
  });

  afterAll(async () => {
    if (worldId) await cleanupCreated(admin, { worldIds: [worldId] });
  });

  it("refuse une joueuse qui voit le bloc sans pouvoir modifier la fiche", async () => {
    const result = await drawPriceListForBlock(player.client, { blockId, userId: player.id, locale: "fr" });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("ne montre rien à un compte hors du monde", async () => {
    const result = await drawPriceListForBlock(outsider.client, { blockId, userId: outsider.id, locale: "fr" });
    expect(result).toEqual({ error: "not_found" });
  });

  it("laisse passer la propriétaire, qui apprend que le monde n'a pas de générateurs", async () => {
    const result = await drawPriceListForBlock(owner.client, { blockId, userId: owner.id, locale: "fr" });
    expect(result).toEqual({ error: "no_generators" });
  });
});
