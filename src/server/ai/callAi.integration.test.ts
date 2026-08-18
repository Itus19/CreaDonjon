import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { AiRateLimitError, runAiCompletion, runAiEmbedding } from "./callAi";
import type { AiProvider, CompletionResult } from "./provider";

/**
 * V1-F1 : sans ce test, rien ne prouve que le point de passage oblige
 * journalise reellement chaque appel dans `ai_usage_log` (succes comme
 * echec) et bloque au-dela de la limite de debit — I/O reelle sur la table,
 * que `rateLimit.test.ts` (pur) ne peut pas exercer. Contact reel a
 * Supabase : se saute silencieusement si .env.local n'est pas configure
 * (meme motif que generators.integration.test.ts).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

function fakeProvider(result: CompletionResult | Error): AiProvider {
  return {
    model: "fake-model-1",
    async complete() {
      if (result instanceof Error) throw result;
      return result;
    },
    async embed(texts: string[]) {
      if (result instanceof Error) throw result;
      return texts.map(() => [0, 0, 0]);
    },
    capabilities() {
      return { toolCalls: false, contextWindow: 8192, embedDim: 3, isLocal: true };
    },
  };
}

describe.skipIf(!hasCreds)("runAiCompletion / runAiEmbedding (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let rateLimitUserId: string;

  async function createTestUser(label: string): Promise<string> {
    const email = `integration-test-callai-${label}-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? "creation utilisateur echouee");
    return data.user.id;
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    userId = await createTestUser("main");
    // Utilisateur dedie au test de limite de debit : les autres tests de ce fichier ecrivent deja plusieurs lignes pour `userId`, ce qui fausserait le compte glissant.
    rateLimitUserId = await createTestUser("ratelimit");
  });

  afterAll(async () => {
    for (const id of [userId, rateLimitUserId]) {
      if (!id) continue;
      await admin.from("ai_usage_log").delete().eq("user_id", id);
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("journalise un appel reussi avec les tokens du resultat", async () => {
    const provider = fakeProvider({ text: "bonjour", toolCalls: [], inputTokens: 12, outputTokens: 34, cachedTokens: 0 });
    const result = await runAiCompletion(admin, provider, { userId, campaignId: null, purpose: "summarize" }, { messages: [] });
    expect(result.text).toBe("bonjour");

    const { data } = await admin.from("ai_usage_log").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
    expect(data?.[0]).toMatchObject({ model: "fake-model-1", purpose: "summarize", input_tokens: 12, output_tokens: 34 });
  });

  it("journalise meme quand le fournisseur echoue, et propage l'erreur d'origine", async () => {
    const provider = fakeProvider(new Error("modele indisponible"));
    await expect(
      runAiCompletion(admin, provider, { userId, campaignId: null, purpose: "summarize" }, { messages: [] })
    ).rejects.toThrow("modele indisponible");

    const { data } = await admin.from("ai_usage_log").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
    expect(data?.[0]).toMatchObject({ model: "fake-model-1", input_tokens: 0, output_tokens: 0 });
  });

  it("journalise aussi un embedding", async () => {
    const provider = fakeProvider({ text: "", toolCalls: [], inputTokens: 5, outputTokens: 0, cachedTokens: 0 });
    const vectors = await runAiEmbedding(admin, provider, { userId, campaignId: null, purpose: "embed" }, ["a", "b"]);
    expect(vectors).toHaveLength(2);

    const { data } = await admin.from("ai_usage_log").select("*").eq("user_id", userId).eq("purpose", "embed").order("created_at", { ascending: false }).limit(1);
    expect(data?.[0]).toMatchObject({ purpose: "embed" });
  });

  it("bloque au-dela de la limite de debit sans appeler le fournisseur, et journalise quand meme l'appel accepte", async () => {
    let calls = 0;
    const provider: AiProvider = {
      model: "fake-model-limit",
      async complete() {
        calls += 1;
        return { text: "x", toolCalls: [], inputTokens: 1, outputTokens: 1, cachedTokens: 0 };
      },
      async embed() {
        return [];
      },
      capabilities() {
        return { toolCalls: false, contextWindow: 8192, embedDim: 3, isLocal: true };
      },
    };
    const context = { userId: rateLimitUserId, campaignId: null, purpose: "summarize" as const };

    // Limite fixee a 1 pour ce test seul : le premier appel passe, le deuxieme est bloque sans jamais toucher le fournisseur.
    await runAiCompletion(admin, provider, context, { messages: [] }, 1);
    expect(calls).toBe(1);

    await expect(runAiCompletion(admin, provider, context, { messages: [] }, 1)).rejects.toBeInstanceOf(AiRateLimitError);
    expect(calls).toBe(1);
  });
});
