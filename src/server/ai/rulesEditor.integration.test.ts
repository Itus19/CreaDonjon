import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { proposeWeaponFromDescription } from "./rulesEditor";
import type { AiProvider, CompletionResult } from "./provider";

/**
 * V1-F2 : sans ce test, rien ne prouve que la nouvelle tentative sur echec
 * de validation Zod fonctionne reellement (envoi des erreurs au modele,
 * deux tentatives maximum, abandon propre) — I/O reelle via `runAiCompletion`
 * (F1) que `weaponProposal.test.ts` (pur) ne peut pas exercer. Contact reel
 * a Supabase : se saute silencieusement si .env.local n'est pas configure
 * (meme motif que callAi.integration.test.ts).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

function scriptedProvider(responses: Array<CompletionResult | "text-only">): AiProvider & { callCount: number } {
  let i = 0;
  return {
    model: "scripted-model",
    callCount: 0,
    async complete() {
      this.callCount += 1;
      const next = responses[Math.min(i, responses.length - 1)];
      i += 1;
      if (next === "text-only") return { text: "je ne sais pas quoi faire", toolCalls: [], inputTokens: 1, outputTokens: 1, cachedTokens: 0 };
      return next;
    },
    async embed() {
      return [];
    },
    capabilities() {
      return { toolCalls: true, contextWindow: 8192, embedDim: 3, isLocal: true };
    },
  };
}

function toolCallResult(input: unknown): CompletionResult {
  return { text: "", toolCalls: [{ name: "propose_weapon", input }], inputTokens: 10, outputTokens: 10, cachedTokens: 0 };
}

const VALID_INPUT = { category: "martial", is_ranged: false, damage_dice_count: 1, damage_dice_faces: 8, damage_type: "tranchant" };

describe.skipIf(!hasCreds)("proposeWeaponFromDescription (integration, base reelle)", () => {
  let admin: SupabaseClient;
  let userId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const email = `integration-test-ruleseditor-${Date.now()}@creadonjon.local`;
    const password = `integration-test-${Date.now()}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? "creation utilisateur echouee");
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("ai_usage_log").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("accepte une proposition valide des la premiere tentative", async () => {
    const provider = scriptedProvider([toolCallResult(VALID_INPUT)]);
    const outcome = await proposeWeaponFromDescription(admin, provider, { userId, campaignId: null }, "Une masse simple, 1d6 contondant.");
    expect(outcome).toEqual({ ok: true, proposal: expect.objectContaining({ damage_type: "tranchant" }) });
    expect(provider.callCount).toBe(1);
  });

  it("reessaie avec les erreurs Zod quand la premiere proposition est invalide, puis reussit", async () => {
    const invalid = { category: "martial", is_ranged: false, damage_dice_count: 1, damage_dice_faces: 20, damage_type: "tranchant" };
    const provider = scriptedProvider([toolCallResult(invalid), toolCallResult(VALID_INPUT)]);
    const outcome = await proposeWeaponFromDescription(admin, provider, { userId, campaignId: null }, "Une epee.");
    expect(outcome.ok).toBe(true);
    expect(provider.callCount).toBe(2);
  });

  it("reessaie quand le modele repond en texte libre sans appeler l'outil", async () => {
    const provider = scriptedProvider(["text-only", toolCallResult(VALID_INPUT)]);
    const outcome = await proposeWeaponFromDescription(admin, provider, { userId, campaignId: null }, "Une epee.");
    expect(outcome.ok).toBe(true);
    expect(provider.callCount).toBe(2);
  });

  it("abandonne apres deux echecs et ne rappelle jamais une troisieme fois", async () => {
    const invalid = { category: "martial", is_ranged: false, damage_dice_count: 1, damage_dice_faces: 20, damage_type: "tranchant" };
    const provider = scriptedProvider([toolCallResult(invalid), toolCallResult(invalid)]);
    const outcome = await proposeWeaponFromDescription(admin, provider, { userId, campaignId: null }, "Une epee.");
    expect(outcome).toEqual({ ok: false });
    expect(provider.callCount).toBe(2);
  });

  it("journalise chaque tentative dans ai_usage_log avec purpose=structure_rule", async () => {
    const provider = scriptedProvider([toolCallResult(VALID_INPUT)]);
    await proposeWeaponFromDescription(admin, provider, { userId, campaignId: null }, "Une epee.");

    const { data } = await admin
      .from("ai_usage_log")
      .select("*")
      .eq("user_id", userId)
      .eq("purpose", "structure_rule")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(data?.[0]).toMatchObject({ purpose: "structure_rule", model: "scripted-model" });
  });
});
