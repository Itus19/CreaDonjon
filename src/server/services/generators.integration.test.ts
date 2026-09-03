import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { SeededRng } from "@/src/core/dice/rng";
import { renderGeneratorTemplate } from "@/src/core/generators/render";
import { drawTableSlotsFromGeneratorBlock } from "./generators";

/**
 * V1-E2 : sans ce test, rien ne prouve que le tirage de generateur resout
 * reellement plusieurs tables de la meme entite et assemble leur texte via
 * le gabarit — I/O reelle, la partie que `render.test.ts` (pur) ne peut pas
 * exercer. Contact reel a Supabase : se saute silencieusement si
 * .env.local n'est pas configure (meme pattern que tables.integration.test.ts).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("tirage sur un bloc generator (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let worldId: string;
  let entityId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-generators-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = userData.user.id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — generateurs", slug: `test-generators-${Date.now()}`, owner_id: userId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, name: "Marche de Valdoria", entity_kind: "location", slug: `marche-test-${Date.now()}`, created_by: userId })
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

  async function insertGeneratorBlock(slots: unknown[], template: string) {
    const { data, error } = await admin
      .from("blocks")
      .insert({
        entity_id: entityId,
        block_type: "generator",
        display: { label: "Nom de marchand", layout: "prose" },
        data: { __v: 1, slots, template },
        display_order: 1000,
        visibility_level: "public",
        visibility_scope_id: null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "creation du generateur echouee");
    return data.id as string;
  }

  it("assemble le texte tire sur deux tables distinctes via le gabarit", async () => {
    await insertTableBlock("prenoms", [{ range: { min: 1, max: 20 }, weight: 20, text: "Aldric" }]);
    await insertTableBlock("metiers", [{ range: { min: 1, max: 20 }, weight: 20, text: "tisserand" }]);
    const generatorId = await insertGeneratorBlock(
      [
        { key: "prenom", table: "prenoms" },
        { key: "metier", table: "metiers" },
      ],
      "{prenom}, {metier}"
    );

    const draw = await drawTableSlotsFromGeneratorBlock(admin, generatorId, new SeededRng(1));
    expect(draw?.slots).toEqual([
      { key: "prenom", text: "Aldric", refs: [], die: "d20", rolled: expect.any(Number) },
      { key: "metier", text: "tisserand", refs: [], die: "d20", rolled: expect.any(Number) },
    ]);
    expect(draw?.proseSlots).toEqual([]);
    expect(renderGeneratorTemplate(draw!.generator.template, draw!.slotTexts)).toBe("Aldric, tisserand");
  });

  it("onlySlotKey : ne tire que l'emplacement designe, jamais les autres", async () => {
    await insertTableBlock("prenoms", [{ range: { min: 1, max: 20 }, weight: 20, text: "Aldric" }]);
    await insertTableBlock("metiers", [{ range: { min: 1, max: 20 }, weight: 20, text: "tisserand" }]);
    const generatorId = await insertGeneratorBlock(
      [
        { key: "prenom", table: "prenoms" },
        { key: "metier", table: "metiers" },
      ],
      "{prenom}, {metier}"
    );

    const draw = await drawTableSlotsFromGeneratorBlock(admin, generatorId, new SeededRng(1), { onlySlotKey: "metier" });
    expect(draw?.slots).toEqual([{ key: "metier", text: "tisserand", refs: [], die: "d20", rolled: expect.any(Number) }]);
    expect(draw?.slotTexts).toEqual({ metier: "tisserand" });
  });

  it("resout la cascade {table:cle} a l'interieur du texte tire pour un emplacement", async () => {
    await insertTableBlock("marchandises", [{ range: { min: 1, max: 20 }, weight: 20, text: "épices" }]);
    await insertTableBlock("rumeurs_marche", [
      { range: { min: 1, max: 20 }, weight: 20, text: "Une cargaison de {table:marchandises} vient d'arriver." },
    ]);
    const generatorId = await insertGeneratorBlock([{ key: "rumeur", table: "rumeurs_marche" }], "{rumeur}");

    const draw = await drawTableSlotsFromGeneratorBlock(admin, generatorId, new SeededRng(2));
    expect(renderGeneratorTemplate(draw!.generator.template, draw!.slotTexts)).toBe("Une cargaison de épices vient d'arriver.");
  });

  it("laisse l'emplacement tel quel dans le gabarit si sa table est introuvable", async () => {
    const generatorId = await insertGeneratorBlock([{ key: "inexistant", table: "table-absente" }], "Resultat : {inexistant}.");

    const draw = await drawTableSlotsFromGeneratorBlock(admin, generatorId, new SeededRng(3));
    expect(draw?.slots).toEqual([]);
    expect(renderGeneratorTemplate(draw!.generator.template, draw!.slotTexts)).toBe("Resultat : {inexistant}.");
  });

  it("collecte les emplacements prose a part, jamais tires comme une table", async () => {
    await insertTableBlock("prenoms", [{ range: { min: 1, max: 20 }, weight: 20, text: "Aldric" }]);
    const generatorId = await insertGeneratorBlock(
      [
        { key: "prenom", table: "prenoms" },
        { key: "description", prose: "Decris ce marchand." },
      ],
      "{prenom} — {description}"
    );

    const draw = await drawTableSlotsFromGeneratorBlock(admin, generatorId, new SeededRng(5));
    expect(draw?.slots).toEqual([{ key: "prenom", text: "Aldric", refs: [], die: "d20", rolled: expect.any(Number) }]);
    expect(draw?.proseSlots).toEqual([{ key: "description", instruction: "Decris ce marchand." }]);
  });

  it("renvoie null pour un bloc introuvable", async () => {
    expect(await drawTableSlotsFromGeneratorBlock(admin, "00000000-0000-0000-0000-000000000000", new SeededRng(4))).toBeNull();
  });
});
