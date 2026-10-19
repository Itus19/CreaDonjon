import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { listDeletedEntitiesForWorld } from "./entities";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

/**
 * V3.1-143 — la base garde qui a supprimé une fiche. Le déclencheur
 * `stamp_entities_deleted_by` pose `auth.uid()` à la suppression, l'efface au
 * rétablissement, et écrase toute écriture directe de `deleted_by`. La
 * corbeille rend le nom de l'auteur.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("auteur d'une suppression (V3.1-143, integration, base reelle)", () => {
  let admin: SupabaseClient;
  let owner: ReusableAccount;
  let playerId: string;
  let worldId: string;
  let entityId: string;

  const deletedBy = async () => {
    const { data, error } = await admin.from("entities").select("deleted_by").eq("id", entityId).single();
    if (error || !data) throw new Error(error?.message ?? "fiche introuvable");
    return (data as { deleted_by: string | null }).deleted_by;
  };

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    owner = await getReusableTestAccount(admin, "owner");
    playerId = (await getReusableTestAccount(admin, "player")).id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde de test auteur de suppression", slug: `integration-test-deleted-by-${Date.now()}`, owner_id: owner.id })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, slug: "fiche-a-supprimer", name: "Fiche à supprimer", entity_kind: "location", created_by: owner.id })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation fiche echouee");
    entityId = entity.id;
  });

  afterAll(async () => {
    if (worldId) await admin.from("worlds").delete().eq("id", worldId);
  });

  it("une écriture directe de deleted_by sur une fiche vivante est écrasée", async () => {
    const { error } = await owner.client.from("entities").update({ deleted_by: playerId }).eq("id", entityId);
    expect(error).toBeNull();
    expect(await deletedBy()).toBeNull();
  });

  it("supprimer pose l'auteur, et la corbeille rend son nom", async () => {
    const { error } = await owner.client.rpc("soft_delete_entity", { p_entity_id: entityId });
    expect(error).toBeNull();
    expect(await deletedBy()).toBe(owner.id);

    const { data: profile } = await admin.from("profiles").select("display_name").eq("id", owner.id).single();
    const corbeille = await listDeletedEntitiesForWorld(owner.client as SupabaseClient<Database>, worldId);
    const ligne = corbeille.find((e) => e.id === entityId);
    expect(ligne?.deletedBy).toBe(owner.id);
    expect(ligne?.deletedByName).toBe((profile as { display_name: string | null } | null)?.display_name || null);
  });

  it("sur une fiche supprimée, réécrire deleted_by ne change pas l'auteur", async () => {
    const { error } = await admin.from("entities").update({ deleted_by: playerId }).eq("id", entityId);
    expect(error).toBeNull();
    expect(await deletedBy()).toBe(owner.id);
  });

  it("rétablir efface l'auteur", async () => {
    const { error } = await owner.client.rpc("restore_entity", { p_entity_id: entityId });
    expect(error).toBeNull();
    expect(await deletedBy()).toBeNull();
  });
});
