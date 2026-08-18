import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { proposeWeaponSchema } from "@/lib/ruleset/schemas";
import { proposeWeaponFromDescription } from "@/src/server/ai/rulesEditor";
import { getOpenAiCompatibleProviderFromEnv } from "@/src/server/ai/adapters/openAiCompatible";
import { AiRateLimitError } from "@/src/server/ai/callAi";

/**
 * Editeur de regle assiste (V1-F2) : propose une structure d'arme depuis
 * une description libre, jamais une ecriture en base — la creation reelle
 * reste `POST /api/worlds/[worldSlug]/rules/weapons` (V1-D4), inchangee,
 * declenchee par l'utilisateur apres relecture du formulaire pre-rempli.
 * `worldSlug` non utilise, meme raisonnement que la route de creation :
 * l'IA n'a besoin d'aucun contexte du monde pour structurer une arme depuis
 * sa description, seulement du contrat de forme (`weaponProposalToolSchema`).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  await params;

  const body = await request.json().catch(() => null);
  const parsed = proposeWeaponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  let provider;
  try {
    provider = getOpenAiCompatibleProviderFromEnv();
  } catch {
    return NextResponse.json({ error: "Aucun fournisseur IA local configure." }, { status: 503 });
  }

  try {
    const outcome = await proposeWeaponFromDescription(supabase, provider, { userId: user.id, campaignId: null }, parsed.data.description);
    return NextResponse.json(outcome, { status: 200 });
  } catch (error) {
    // Meme discipline que POST /rules/weapons (V1-D4) : seul le cas connu et
    // attendu est intercepte, tout le reste remonte (500 generique de Next),
    // jamais un catch qui avale silencieusement une erreur inattendue.
    if (error instanceof AiRateLimitError) {
      return NextResponse.json({ error: "Trop de propositions demandees, reessaie dans quelques minutes." }, { status: 429 });
    }
    throw error;
  }
}
