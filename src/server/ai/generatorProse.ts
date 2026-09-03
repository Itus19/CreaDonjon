import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { formatSlotValuesForPrompt } from "@/src/core/generators/render";
import { fenceUntrustedData } from "@/src/core/ai/promptSafety";
import type { ProseLength } from "@/src/core/generators/types";
import type { AiProvider } from "./provider";
import { runAiCompletion, AiRateLimitError } from "./callAi";

type TypedClient = SupabaseClient<Database>;

export interface PendingProseSlot {
  key: string;
  /** Consigne de l'auteur du generateur (`GeneratorProseSlot.prose`) — texte de confiance (ecrit par qui edite ce bloc), jamais encadre comme donnee. */
  instruction: string;
}

export interface ProseGenerationContext {
  userId: string;
}

/** ~2.2 tokens/mot en francais avec une marge confortable — jamais une troncature en plein milieu de phrase pour la longueur la plus courte. */
function maxOutputTokensFor(proseLength: ProseLength): number {
  return Math.ceil(proseLength * 3);
}

function buildSystemPrompt(proseLength: ProseLength): string {
  return (
    `Tu ecris un court texte narratif pour une table de jeu de role, en francais. Vise environ ${proseLength} mots — ` +
    "ni une simple phrase si on t'en demande davantage, ni un roman si on t'en demande peu. Prose seule, sans titre, " +
    "sans liste, sans markdown, prete a etre lue telle quelle. Integre naturellement les elements deja determines " +
    "fournis ci-dessous, sans jamais les lister brutalement ni les contredire."
  );
}

/**
 * Redige chaque emplacement `prose` d'un generateur (V2-J1, specs/outils-mj.md
 * §3) a partir des emplacements `table` DEJA tires — jamais l'inverse.
 * Chaque emplacement declenche son propre appel (`purpose: "generator_prose"`,
 * `ai_usage_log` ecrit a chaque appel via `runAiCompletion`, y compris en cas
 * d'echec, CLAUDE.md regle 13). La consigne de l'auteur (`instruction`) est
 * un texte de confiance ; les valeurs deja tirees, elles, sont encadrees
 * comme donnee (`fenceUntrustedData`, CLAUDE.md regle 8) — jamais interpolees
 * directement dans la consigne, qui resterait alors un melange indistinct
 * d'instruction et de contenu du monde.
 *
 * "Sans fournisseur d'IA actif" (critere du ticket) couvre plus que
 * l'absence de configuration : un `AI_LOCAL_BASE_URL` renseigne mais LM
 * Studio/Ollama pas lance au moment precis du clic (`ECONNREFUSED`) est,
 * pour l'auteur, exactement le meme etat — "pas de fournisseur actif
 * maintenant". Chaque emplacement echoue donc INDIVIDUELLEMENT et sans
 * relancer l'erreur (reste simplement vide, le tirage entier ne doit
 * jamais planter pour ca) — sauf `AiRateLimitError`, seul cas qui reste un
 * vrai signal a montrer (l'auteur a demande trop de generations, pas "pas
 * de fournisseur").
 */
export async function resolveGeneratorProseSlots(
  supabase: TypedClient,
  provider: AiProvider,
  context: ProseGenerationContext,
  proseSlots: readonly PendingProseSlot[],
  tableSlotTexts: Readonly<Record<string, string>>,
  proseLength: ProseLength
): Promise<Record<string, string>> {
  // Chaque emplacement demarre a vide, jamais absent : un emplacement
  // `prose` non resolu doit disparaitre proprement du gabarit rendu (une
  // chaine vide), jamais laisser `{cle}` visible comme le fait un
  // emplacement `table` mal configure (etat distinct — celui-la est une
  // erreur a corriger, celui-ci une absence de fournisseur attendue).
  const resolved: Record<string, string> = Object.fromEntries(proseSlots.map((slot) => [slot.key, ""]));
  for (const slot of proseSlots) {
    try {
      const result = await runAiCompletion(
        supabase,
        provider,
        { userId: context.userId, campaignId: null, purpose: "generator_prose" },
        {
          messages: [
            { role: "system", content: buildSystemPrompt(proseLength) },
            {
              role: "user",
              content: [slot.instruction, "", fenceUntrustedData("elements-generes", formatSlotValuesForPrompt(tableSlotTexts))].join("\n"),
            },
          ],
          maxOutputTokens: maxOutputTokensFor(proseLength),
        }
      );
      resolved[slot.key] = result.text.trim();
    } catch (error) {
      if (error instanceof AiRateLimitError) throw error;
      // Jamais silencieux cote serveur (CLAUDE.md, "pas de catch silencieux")
      // meme si le joueur/MJ ne voit qu'un emplacement vide : la ligne
      // ai_usage_log deja ecrite par runAiCompletion garde la trace de
      // l'appel, cette ligne de log garde le detail de l'erreur.
      console.error(`[generator_prose] emplacement "${slot.key}" non resolu :`, error);
    }
  }
  return resolved;
}
