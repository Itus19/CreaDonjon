import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/src/server/ai/rateLimit";

/**
 * Ce qu'il reste d'appels IA dans la fenetre glissante de l'utilisateur
 * (V1-F1, une heure). V3.1-65 : l'encart d'assistance du bloc Texte affiche
 * ce nombre AVANT de proposer — sans quoi « Proposer » peut echouer en 429
 * sans que rien ne l'ait laisse prevoir.
 *
 * Lecture seule et propre a l'appelant : aucune entree, donc aucun schema
 * Zod a poser (regle 4) ; `checkAiRateLimit` ne compte que les lignes
 * `ai_usage_log` de cet utilisateur.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const decision = await checkAiRateLimit(supabase, user.id);
  return NextResponse.json({ remaining: decision.remaining });
}
