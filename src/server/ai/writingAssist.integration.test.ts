import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { proposeTextForBlock } from "./writingAssist";
import type { AiProvider, CompletionResult } from "./provider";

/**
 * V1-F3 : sans ce test, rien ne prouve que chaque appel d'outil devient une
 * ligne `ai_proposals` reelle (jamais une ecriture directe de bloc), que le
 * budget par tour rejette et journalise le surplus, et que l'entite/le bloc
 * cibles viennent toujours de l'appelant, jamais de la sortie du modele.
 * Contact reel a Supabase : se saute silencieusement si .env.local n'est
 * pas configure (meme motif que callAi.integration.test.ts).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

function toolCallResult(...inputs: unknown[]): CompletionResult {
  return {
    text: "",
    toolCalls: inputs.map((input) => ({ name: "propose_text", input })),
    inputTokens: 10,
    outputTokens: 10,
    cachedTokens: 0,
  };
}

function scriptedProvider(result: CompletionResult): AiProvider {
  return {
    model: "scripted-model",
    async complete() {
      return result;
    },
    async embed() {
      return [];
    },
    capabilities() {
      return { toolCalls: true, contextWindow: 8192, embedDim: 3, isLocal: true };
    },
  };
}

describe.skipIf(!hasCreds)("proposeTextForBlock (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let worldId: string;
  let entityId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const email = `integration-test-writingassist-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (userError || !userData.user) throw new Error(userError?.message ?? "creation utilisateur echouee");
    userId = userData.user.id;

    const { data: world, error: worldError } = await admin
      .from("worlds")
      .insert({ name: "Monde test — assistance redactionnelle", slug: `test-writingassist-${Date.now()}`, owner_id: userId })
      .select("id")
      .single();
    if (worldError || !world) throw new Error(worldError?.message ?? "creation monde echouee");
    worldId = world.id;

    const { data: entity, error: entityError } = await admin
      .from("entities")
      .insert({ world_id: worldId, name: "Village test", entity_kind: "location", slug: `village-test-${Date.now()}`, created_by: userId })
      .select("id")
      .single();
    if (entityError || !entity) throw new Error(entityError?.message ?? "creation entite echouee");
    entityId = entity.id;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("ai_proposals").delete().eq("target_entity_id", entityId);
      await admin.from("entities").delete().eq("created_by", userId);
      await admin.from("worlds").delete().eq("owner_id", userId);
      await admin.from("ai_usage_log").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("cree une proposition en attente pour un appel d'outil valide", async () => {
    const provider = scriptedProvider(toolCallResult({ text: "Le village vit de la peche et du commerce fluvial." }));
    const created = await proposeTextForBlock(admin, provider, { worldId, entityId, userId }, "block-1", "Decris ce village.");

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ status: "pending", kind: "update_block", targetEntityId: entityId });
    expect(created[0].payload).toMatchObject({ blockId: "block-1", text: "Le village vit de la peche et du commerce fluvial." });
  });

  it("rejette et journalise une proposition qui echoue a la validation Zod", async () => {
    const provider = scriptedProvider(toolCallResult({ text: "" }));
    const created = await proposeTextForBlock(admin, provider, { worldId, entityId, userId }, "block-1", "Decris ce village.");

    expect(created).toHaveLength(1);
    expect(created[0].status).toBe("rejected");
    expect(created[0].validationErrors).toMatchObject({ reason: "invalid" });
  });

  it("rejette et journalise le surplus au-dela du budget par tour, sans perdre les propositions valides sous la limite", async () => {
    const provider = scriptedProvider(
      toolCallResult({ text: "Un." }, { text: "Deux." }, { text: "Trois." }, { text: "Quatre." }, { text: "Cinq." })
    );
    const created = await proposeTextForBlock(admin, provider, { worldId, entityId, userId }, "block-1", "Propose plusieurs paragraphes.");

    expect(created).toHaveLength(5);
    expect(created.filter((p) => p.status === "pending")).toHaveLength(3);
    const rejected = created.filter((p) => p.status === "rejected");
    expect(rejected).toHaveLength(2);
    for (const r of rejected) expect(r.validationErrors).toMatchObject({ reason: "budget_exceeded" });
  });

  it("ignore toute tentative du modele de fournir un identifiant — seul le blockId de l'appelant est utilise", async () => {
    const provider = scriptedProvider(toolCallResult({ text: "Texte valide.", blockId: "block-invente-par-le-modele", entityId: "autre-entite" }));
    const created = await proposeTextForBlock(admin, provider, { worldId, entityId, userId }, "block-reel", "Decris ce village.");

    expect(created[0].targetEntityId).toBe(entityId);
    expect(created[0].payload).toMatchObject({ blockId: "block-reel" });
  });

  it("journalise l'usage avec purpose=assist_writing", async () => {
    const provider = scriptedProvider(toolCallResult({ text: "Texte." }));
    await proposeTextForBlock(admin, provider, { worldId, entityId, userId }, "block-1", "Decris ce village.");

    const { data } = await admin
      .from("ai_usage_log")
      .select("*")
      .eq("user_id", userId)
      .eq("purpose", "assist_writing")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(data?.[0]).toMatchObject({ purpose: "assist_writing", model: "scripted-model" });
  });
});
