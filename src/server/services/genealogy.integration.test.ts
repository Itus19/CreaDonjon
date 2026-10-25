import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getFamilyTree } from "./genealogy";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-74 : la généalogie porte naissance et mort, lues dans le bloc
 * `character`. Ce bloc a sa propre visibilité : une date réservée au MJ ne
 * doit jamais partir vers un lecteur qui ne voit pas le bloc (règle 5).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const year = (y: number) => ({ year: y, month: null, day: null, precision: "year", end: null, label: null });

describe.skipIf(!hasCreds)("généalogie : dates de vie et visibilité (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let ownerId: string;
  let worldId: string;
  let parentId: string;
  let childId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    ownerId = (await getReusableTestAccount(admin, "owner")).id;
    const { data: world, error } = await admin
      .from("worlds")
      .insert({ name: "Monde de test genealogie", slug: `integration-test-genealogy-${Date.now()}`, owner_id: ownerId })
      .select("id")
      .single();
    if (error || !world) throw new Error(error?.message ?? "creation monde echouee");
    worldId = world.id;

    const entity = async (slug: string, name: string) => {
      const { data, error: e } = await admin
        .from("entities")
        .insert({ world_id: worldId, slug, name, entity_kind: "character", created_by: ownerId, is_public: true })
        .select("id")
        .single();
      if (e || !data) throw new Error(e?.message ?? "creation fiche echouee");
      return data.id as string;
    };
    parentId = await entity("aldric", "Aldric");
    childId = await entity("mira", "Mira");

    const { error: relError } = await admin.from("relations").insert({
      world_id: worldId,
      source_entity_id: parentId,
      target_entity_id: childId,
      relation_type: "parent_of",
      visibility_level: "public",
      created_by: ownerId,
    });
    if (relError) throw new Error(relError.message);

    const block = async (entityId: string, visibility: string, data: Record<string, unknown>) => {
      const { error: e } = await admin.from("blocks").insert({
        entity_id: entityId,
        block_type: "character",
        display: { label: "Personnage" },
        data,
        display_order: 0,
        visibility_level: visibility,
        created_by: ownerId,
      });
      if (e) throw new Error(e.message);
    };
    // Le parent : naissance et mort publiques. L'enfant : naissance réservée au MJ.
    await block(parentId, "public", { birth: year(1420), death: year(1478) });
    await block(childId, "gm", { birth: year(1450) });
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("le lecteur public voit les dates publiques, jamais celles réservées au MJ", async () => {
    const tree = await getFamilyTree(admin, { worldId, rootEntityId: parentId, depthUp: 2, depthDown: 2, viewer: { kind: "anonymous" } });
    const parent = tree.nodes.find((n) => n.id === parentId);
    const child = tree.nodes.find((n) => n.id === childId);
    expect(parent).toMatchObject({ birth: { year: 1420 }, death: { year: 1478 } });
    expect(child).toBeDefined();
    expect(child).not.toHaveProperty("birth");
    // V3.1-73 : sans portrait, la carte le sait d'avance (pas de requête d'image vouée au 404).
    expect(tree.nodes.every((n) => n.hasPortrait === false)).toBe(true);
  });

  it("le MJ voit toutes les dates", async () => {
    const tree = await getFamilyTree(admin, {
      worldId,
      rootEntityId: parentId,
      depthUp: 2,
      depthDown: 2,
      viewer: { kind: "user", userId: ownerId, worldRole: "owner", campaignRoles: {} },
    });
    expect(tree.nodes.find((n) => n.id === childId)).toMatchObject({ birth: { year: 1450 } });
  });
});
