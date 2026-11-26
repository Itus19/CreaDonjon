import { beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getOpenAiCompatibleProviderFromEnv } from "./adapters/openAiCompatible";
import { classifySoloAction } from "./soloClassify";
import { getReusableTestAccount } from "../testUtils/reusableTestAccounts";
import { CHECK_CLASSIFY_CORPUS } from "@/src/core/ai/checkClassifyCorpus";

/**
 * V3.2-23 (ADR 0113) — rejoue le corpus d'évaluation contre le fournisseur
 * local et donne le taux d'accord avec un MJ attentif.
 *
 * **Jamais dans la suite ordinaire** : un appel de modèle par phrase (une
 * cinquantaine), et autant de lignes dans `ai_usage_log` (docs/QUOTAS.md
 * T2). Il ne tourne que si `AI_EVAL_CLASSEMENT=1`, avec la base et le
 * fournisseur local joignables :
 *
 *   AI_EVAL_CLASSEMENT=1 npx vitest run src/server/ai/soloClassify.eval.integration.test.ts
 *
 * Le seuil (70 %) dit seulement si le modèle est utilisable ; le détail des
 * désaccords s'affiche pour corriger le prompt ou le corpus.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = process.env.AI_EVAL_CLASSEMENT === "1" && Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && process.env.AI_LOCAL_BASE_URL && process.env.AI_LOCAL_MODEL);

describe.skipIf(!enabled)("le classement « faut-il un jet ? » contre le corpus (évaluation, modèle réel)", () => {
  let admin: SupabaseClient<Database>;
  let userId: string;

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    userId = (await getReusableTestAccount(admin, "player")).id;
  });

  it("s'accorde avec le corpus sur au moins 70 % des phrases", async () => {
    const provider = getOpenAiCompatibleProviderFromEnv();
    const desaccords: string[] = [];
    for (const entry of CHECK_CLASSIFY_CORPUS) {
      const detection = await classifySoloAction(
        admin,
        provider,
        { userId, campaignId: null, text: entry.text, actorName: "Edran", presents: entry.presents ?? [] },
        CHECK_CLASSIFY_CORPUS.length * 2
      );
      const ok =
        detection !== null &&
        detection.kind === entry.expected &&
        (detection.kind !== "check" || (entry.skills ?? []).includes(detection.action.key));
      if (!ok) {
        const rendu = detection === null ? "illisible" : detection.kind === "check" ? `check ${detection.action.key} ${detection.tier}` : detection.kind;
        desaccords.push(`« ${entry.text} » : attendu ${entry.expected}${entry.skills ? ` (${entry.skills.join(" | ")})` : ""}, rendu ${rendu}`);
      }
    }
    const accord = 1 - desaccords.length / CHECK_CLASSIFY_CORPUS.length;
    console.info(`Accord du classement : ${Math.round(accord * 100)} % (${CHECK_CLASSIFY_CORPUS.length - desaccords.length}/${CHECK_CLASSIFY_CORPUS.length})\n${desaccords.join("\n")}`);
    expect(accord).toBeGreaterThanOrEqual(0.7);
  }, 600_000);
});
