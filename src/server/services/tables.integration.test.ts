import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { SeededRng } from "@/src/core/dice/rng";
import { drawFromTableBlock } from "./tables";
import { TableCascadeCycleError } from "@/src/core/tables/errors";

/**
 * V1-E1 : sans ce test, rien ne prouve que le tirage en cascade resout
 * reellement une reference `{table:cle}` en interrogeant une AUTRE table de
 * la meme entite (I/O reelle — la partie que les tests purs de
 * `src/core/tables/roll.test.ts` ne peuvent pas exercer), ni que le detecteur
 * de cycle se declenche sur un vrai aller-retour entre deux blocs en base.
 *
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme pattern que les autres tests d'integration).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("tirage sur random_table, cascade et cycles (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let worldId: string;
  let entityId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-tables-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = userData.user.id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — tables aleatoires", slug: `test-tables-${Date.now()}`, owner_id: userId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, name: "Auberge du Sanglier", entity_kind: "location", slug: `auberge-test-${Date.now()}`, created_by: userId })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    entityId = entity.id;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("entities").delete().eq("created_by", userId);
      await admin.from("worlds").delete().eq("owner_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  async function insertTableBlock(key: string, entries: unknown[]) {
    const { data, error } = await admin
      .from("blocks")
      .insert({
        entity_id: entityId,
        block_type: "random_table",
        display: { label: key, layout: "table" },
        data: { __v: 1, key, die: "d20", entries, unique_draws: false },
        display_order: 1000,
        visibility_level: "public",
        visibility_scope_id: null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? `creation du bloc "${key}" echouee`);
    return data.id as string;
  }

  it("tire un resultat simple, sans cascade", async () => {
    const blockId = await insertTableBlock("simple", [
      { range: { min: 1, max: 20 }, weight: 20, text: "Rien à signaler." },
    ]);
    const draws = await drawFromTableBlock(admin, blockId, new SeededRng(1), 1);
    expect(draws).toEqual([{ text: "Rien à signaler.", refs: [] }]);
  });

  it("resout un tirage en cascade en interrogeant l'autre table de la meme entite", async () => {
    await insertTableBlock("marchands", [
      { range: { min: 1, max: 20 }, weight: 20, text: "des tisserands de Valdoria" },
    ]);
    const rumorsBlockId = await insertTableBlock("rumeurs", [
      { range: { min: 1, max: 20 }, weight: 20, text: "Une caravane de {table:marchands} cherche une escorte." },
    ]);

    const draws = await drawFromTableBlock(admin, rumorsBlockId, new SeededRng(2), 1);
    expect(draws).toEqual([{ text: "Une caravane de des tisserands de Valdoria cherche une escorte.", refs: [] }]);
  });

  it("detecte un cycle entre deux tables qui se referencent mutuellement", async () => {
    const { data: blockA } = await admin
      .from("blocks")
      .insert({
        entity_id: entityId,
        block_type: "random_table",
        display: { label: "cycle-a", layout: "table" },
        data: { __v: 1, key: "cycle-a", die: "d20", entries: [{ range: { min: 1, max: 20 }, weight: 20, text: "{table:cycle-b}" }], unique_draws: false },
        display_order: 1000,
        visibility_level: "public",
        visibility_scope_id: null,
        created_by: userId,
      })
      .select("id")
      .single();
    await admin
      .from("blocks")
      .insert({
        entity_id: entityId,
        block_type: "random_table",
        display: { label: "cycle-b", layout: "table" },
        data: { __v: 1, key: "cycle-b", die: "d20", entries: [{ range: { min: 1, max: 20 }, weight: 20, text: "{table:cycle-a}" }], unique_draws: false },
        display_order: 1000,
        visibility_level: "public",
        visibility_scope_id: null,
        created_by: userId,
      });

    await expect(drawFromTableBlock(admin, blockA!.id, new SeededRng(3), 1)).rejects.toThrow(TableCascadeCycleError);
  });

  it("renvoie null pour un bloc introuvable", async () => {
    expect(await drawFromTableBlock(admin, "00000000-0000-0000-0000-000000000000", new SeededRng(4), 1)).toBeNull();
  });
});
