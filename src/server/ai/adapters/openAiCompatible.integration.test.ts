import { beforeAll, describe, expect, it } from "vitest";
import { getOpenAiCompatibleProviderFromEnv } from "./openAiCompatible";

/**
 * V1-F2 : sans ce test, rien ne prouve que l'adaptateur parse correctement
 * une vraie reponse de LM Studio/Ollama (structure des tool_calls, usage) —
 * un fournisseur factice (comme dans callAi.integration.test.ts) ne peut
 * verifier que la logique de callAi.ts, jamais le format reel d'une API
 * compatible OpenAI. Se saute silencieusement si AI_LOCAL_BASE_URL n'est pas
 * configure (meme motif describe.skipIf que les tests Supabase) ou si le
 * serveur local ne repond pas au moment du test (verifie dynamiquement,
 * pas seulement la presence de la variable d'environnement).
 */
const hasEnv = Boolean(process.env.AI_LOCAL_BASE_URL && process.env.AI_LOCAL_MODEL);

async function isReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.AI_LOCAL_BASE_URL}/models`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

describe.skipIf(!hasEnv)("OpenAiCompatibleProvider (integration, serveur local reel)", () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await isReachable();
    if (!reachable) console.warn(`AI_LOCAL_BASE_URL (${process.env.AI_LOCAL_BASE_URL}) injoignable — tests de ce fichier sautes.`);
  });

  it("propose une structure d'arme via un vrai appel d'outil", async (ctx) => {
    if (!reachable) ctx.skip();
    const provider = getOpenAiCompatibleProviderFromEnv();

    const result = await provider.complete({
      messages: [
        {
          role: "user",
          content:
            "Une epee longue inflige 1d8 tranchant, 1d10 si maniee a deux mains. Propose la structure via l'outil propose_weapon.",
        },
      ],
      tools: [
        {
          name: "propose_weapon",
          description: "Propose la structure d'une arme",
          inputSchema: {
            type: "object",
            properties: {
              damage_dice_faces: { type: "integer" },
              damage_type: { type: "string" },
            },
            required: ["damage_dice_faces", "damage_type"],
          },
        },
      ],
    });

    // Le nombre exact d'appels depend du modele charge (certains en emettent un par
    // variante de degats face a un schema minimal sans champ "versatile") — ce test
    // verifie que l'adaptateur parse correctement la reponse, pas le comportement
    // exact d'un modele donne (verifie plutot par rulesEditor.integration.test.ts,
    // avec le vrai schema qui a un champ dedie pour le mode a deux mains).
    expect(result.toolCalls.length).toBeGreaterThanOrEqual(1);
    expect(result.toolCalls[0].name).toBe("propose_weapon");
    expect(result.toolCalls[0].input).toMatchObject({ damage_type: "tranchant" });
    expect(result.inputTokens).toBeGreaterThan(0);
  }, 20_000);
});
