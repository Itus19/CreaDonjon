import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { ABILITIES, ABILITY_LABELS, SKILLS } from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import {
  CHECK_CLASSIFY_TOOL,
  buildCheckClassifyMessages,
  checkClassifyToolSchema,
  classifiableActions,
  readCheckClassification,
  type CheckDetection,
} from "@/src/core/ai/checkClassify";
import type { AiProvider } from "./provider";
import { runAiCompletion } from "./callAi";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.2-23 (ADR 0113) — « Faut-il un jet ? », demandé au modèle avant de
 * jouer un tour libre.
 *
 * **Ne décide rien.** Le modèle classe la phrase dans une liste fermée ; le
 * moteur en tire le DD (`dcForTier`) et la réussite automatique, plus tard,
 * dans `proposeIntentRequest`. Ce fichier n'écrit rien en base, hors du
 * journal `ai_usage_log` que `runAiCompletion` tient à chaque appel, échec
 * compris (règle 13).
 *
 * **Ne fait jamais échouer le tour.** Fournisseur injoignable, limite de
 * débit, réponse sans appel d'outil ou invalide : `null`, avec la raison
 * dans la console du serveur, et le tour garde la lecture du lexique
 * (V3.2-21). Le jeu reste jouable sans IA.
 *
 * Contexte borné au joueur (règle 11) : sa phrase, son nom, les présents
 * qu'il voit (`IntentBarData.targetDetails`, déjà filtrés pour lui), et les
 * noms des tests. Aucune page du wiki.
 */

/** Les tests de la fiche, dans l'ordre de la barre : compétences, puis tests et sauvegardes de caractéristique. */
export const SOLO_CLASSIFIABLE_ACTIONS = classifiableActions(
  SKILLS.map((s) => ({ id: s, label: SKILL_LABELS_FR[s] })),
  ABILITIES.map((a) => ({ id: a, label: ABILITY_LABELS[a] }))
);

export async function classifySoloAction(
  supabase: TypedClient,
  provider: AiProvider,
  params: { userId: string; campaignId: string | null; text: string; actorName: string; presents: string[] },
  /** La limite de débit (`checkAiRateLimit`) ; seule l'évaluation hors ligne du corpus la relève. */
  limit?: number
): Promise<CheckDetection | null> {
  const { system, user } = buildCheckClassifyMessages({
    text: params.text,
    actorName: params.actorName,
    presents: params.presents,
    actions: SOLO_CLASSIFIABLE_ACTIONS,
  });
  try {
    const result = await runAiCompletion(
      supabase,
      provider,
      { userId: params.userId, campaignId: params.campaignId, purpose: "solo_classify" },
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [{ name: CHECK_CLASSIFY_TOOL, description: "Classer l'action du joueur : faut-il un jet ?", inputSchema: checkClassifyToolSchema(SOLO_CLASSIFIABLE_ACTIONS) }],
        maxOutputTokens: 200,
      },
      limit
    );
    const call = result.toolCalls.find((c) => c.name === CHECK_CLASSIFY_TOOL);
    const detection = call ? readCheckClassification(call.input, SOLO_CLASSIFIABLE_ACTIONS) : null;
    if (!detection) console.error("Classement du tour inutilisable, retour au lexique", call?.input ?? result.text.slice(0, 200));
    return detection;
  } catch (erreur) {
    console.error("Classement du tour impossible, retour au lexique", erreur);
    return null;
  }
}
