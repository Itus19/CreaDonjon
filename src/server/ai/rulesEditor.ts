import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { zWeaponProposal, weaponProposalToolSchema, type WeaponProposal } from "@/src/core/ai/weaponProposal";
import type { AiCompletionMessage, AiProvider } from "./provider";
import { runAiCompletion } from "./callAi";

type TypedClient = SupabaseClient<Database>;

const TOOL_NAME = "propose_weapon";
/** Deux tentatives maximum, puis on rend la main (specs/regles-couche.md §5.1). */
const MAX_ATTEMPTS = 2;

const SYSTEM_PROMPT =
  "Tu aides a structurer une arme de jeu de role a partir d'une description en francais. " +
  `Utilise TOUJOURS l'outil ${TOOL_NAME}, une seule fois par reponse, jamais de reponse en texte libre. ` +
  "Les des de degats sont limites a d4, d6, d8, d10 ou d12. Si l'arme se manie a deux mains pour plus de " +
  "degats (\"polyvalente\"/\"versatile\"), remplis versatile_dice_count et versatile_dice_faces ; sinon " +
  "laisse-les vides.";

export type WeaponProposalOutcome = { ok: true; proposal: WeaponProposal } | { ok: false };

/**
 * Flux « editeur de regle assiste » pour l'arme (V1-F2, specs/regles-couche.md
 * §5.1) : appel d'outil (jamais du JSON extrait de prose) -> validation Zod
 * -> en cas d'echec, les erreurs repartent au modele pour une seconde
 * tentative -> puis on abandonne. Chaque tentative passe par
 * `runAiCompletion` (V1-F1) : limite de debit et journalisation deja
 * garanties, rien a refaire ici.
 */
export async function proposeWeaponFromDescription(
  supabase: TypedClient,
  provider: AiProvider,
  context: { userId: string; campaignId: string | null },
  description: string
): Promise<WeaponProposalOutcome> {
  const messages: AiCompletionMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: description },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await runAiCompletion(
      supabase,
      provider,
      { userId: context.userId, campaignId: context.campaignId, purpose: "structure_rule" },
      {
        messages,
        tools: [
          {
            name: TOOL_NAME,
            description: "Propose la structure d'une arme de jeu de role",
            inputSchema: weaponProposalToolSchema,
          },
        ],
      }
    );

    const call = result.toolCalls.find((tc) => tc.name === TOOL_NAME);
    if (!call) {
      messages.push({ role: "assistant", content: result.text || "(aucun appel d'outil)" });
      messages.push({ role: "user", content: `Tu dois appeler l'outil ${TOOL_NAME}, pas repondre en texte. Reessaie.` });
      continue;
    }

    const parsed = zWeaponProposal.safeParse(call.input);
    if (parsed.success) return { ok: true, proposal: parsed.data };

    const errors = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(racine)"} : ${issue.message}`).join(" ; ");
    messages.push({ role: "assistant", content: JSON.stringify(call.input) });
    messages.push({
      role: "user",
      content: `Ta proposition ne respecte pas le format attendu : ${errors}. Corrige-la et rappelle l'outil ${TOOL_NAME}.`,
    });
  }

  return { ok: false };
}
