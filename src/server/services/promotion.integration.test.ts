import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { promoteToEntity } from "./promotion";

/**
 * V2-J2 : mecanisme generique de promotion (V1-E6) — sans ce test, rien ne
 * prouve que `promoteToEntity` cree reellement l'entite ET ses blocs avec
 * les bons segments (texte + references inline), I/O reelle que les tests
 * purs ne peuvent pas exercer. Meme motif que generators.integration.test.ts :
 * se saute silencieusement si .env.local n'est pas configure.
 *
 * `createEntity` (via `generateUniqueEntitySlug`/`world_has_slug`, une RPC
 * `security definer` qui verifie l'appartenance au monde via `auth.uid()`)
 * exige une VRAIE session utilisateur — jamais le client service-role brut,
 * qui n'a pas de `auth.uid()` (meme motif que entityHistory.integration.test.ts).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

describe.skipIf(!hasCreds)("promotion generique en entite (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let userId: string;
  let worldId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `integration-test-promotion-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = userData.user.id;

    userClient = createSupabaseClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await userClient.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(signInError.message);

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — promotion", slug: `test-promotion-${Date.now()}`, owner_id: userId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("entities").delete().eq("created_by", userId);
      await admin.from("worlds").delete().eq("owner_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  async function blocksForEntity(entityId: string) {
    const { data, error } = await admin.from("blocks").select("*").eq("entity_id", entityId).order("display_order");
    if (error) throw new Error(error.message);
    return data;
  }

  it("cree l'entite et un bloc text par emplacement, texte en premier paragraphe", async () => {
    const result = await promoteToEntity(userClient, {
      worldId,
      createdBy: userId,
      name: "L'Auberge du Cerf Bleu",
      entityKind: "location",
      visibilityLevel: "public",
      visibilityScopeId: null,
      blocks: [{ label: "L'établissement", text: "Une taverne bruyante et enfumée." }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.entity.name).toBe("L'Auberge du Cerf Bleu");
    expect(result.entity.entity_kind).toBe("location");

    const blocks = await blocksForEntity(result.entity.id);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].block_type).toBe("text");
    expect(blocks[0].display.label).toBe("L'établissement");
    expect(blocks[0].data.segments).toEqual([
      {
        id: expect.any(String),
        blockType: "paragraph",
        visibility: { level: "public", scopeId: null },
        content: [{ t: "text", v: "Une taverne bruyante et enfumée." }],
        align: "left",
      },
    ]);
  });

  it("embarque les references comme un second paragraphe de noeuds ref, jamais une ligne relations", async () => {
    const result = await promoteToEntity(userClient, {
      worldId,
      createdBy: userId,
      name: "La Rose Écarlate",
      entityKind: "location",
      visibilityLevel: "public",
      visibilityScopeId: null,
      blocks: [
        {
          label: "L'établissement",
          text: "Le patron affiche fièrement son trophée.",
          refNodes: [{ kind: "entity", id: "11111111-1111-1111-1111-111111111111", label: "Le Poignard des Trois Silences" }],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const blocks = await blocksForEntity(result.entity.id);
    expect(blocks).toHaveLength(1);
    const segments = blocks[0].data.segments;
    expect(segments).toHaveLength(2);
    expect(segments[1].content).toEqual([
      { t: "text", v: "Références : " },
      { t: "ref", kind: "entity", id: "11111111-1111-1111-1111-111111111111", key: undefined, label: "Le Poignard des Trois Silences" },
    ]);

    const { data: relations } = await admin
      .from("relations")
      .select("id")
      .or(`source_entity_id.eq.${result.entity.id},target_entity_id.eq.${result.entity.id}`);
    expect(relations).toEqual([]);
  });

  it("omet un emplacement vide (ni texte ni reference) plutot que de creer un bloc inutile", async () => {
    const result = await promoteToEntity(userClient, {
      worldId,
      createdBy: userId,
      name: "La Chambre vide",
      entityKind: "location",
      visibilityLevel: "public",
      visibilityScopeId: null,
      blocks: [
        { label: "L'établissement", text: "Rempli." },
        { label: "La Chambre", text: "" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const blocks = await blocksForEntity(result.entity.id);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].display.label).toBe("L'établissement");
  });
});
