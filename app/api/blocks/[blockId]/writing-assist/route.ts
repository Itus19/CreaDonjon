import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writingAssistSchema } from "@/lib/blocks/schemas";
import { getBlockById } from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { proposeTextForBlock } from "@/src/server/ai/writingAssist";
import { getOpenAiCompatibleProviderFromEnv } from "@/src/server/ai/adapters/openAiCompatible";
import { AiRateLimitError } from "@/src/server/ai/callAi";

/**
 * Assistance redactionnelle (V1-F3) : propose du texte pour un bloc `text`
 * existant. N'ecrit jamais le bloc directement — chaque proposition devient
 * une ligne `ai_proposals` en attente, relue via `POST /api/ai-proposals/
 * [proposalId]/apply` (ou `/reject`). Le bloc et l'entite viennent de la
 * route (`blockId`), jamais du corps de la requete ni de la sortie du
 * modele — c'est ce qui rend vrai "le modele ne peut referencer que des
 * identifiants fournis dans le contexte du tour" (critere du ticket).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = writingAssistSchema.safeParse(body);
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

  const block = await getBlockById(supabase, blockId);
  if (!block || block.block_type !== "text") {
    return NextResponse.json({ error: "Bloc de texte introuvable." }, { status: 404 });
  }
  const entity = await getEntityById(supabase, block.entity_id);
  if (!entity) {
    return NextResponse.json({ error: "Entite introuvable." }, { status: 404 });
  }

  let provider;
  try {
    provider = getOpenAiCompatibleProviderFromEnv();
  } catch {
    return NextResponse.json({ error: "Aucun fournisseur IA local configure." }, { status: 503 });
  }

  try {
    const proposals = await proposeTextForBlock(
      supabase,
      provider,
      { worldId: entity.world_id, entityId: entity.id, userId: user.id },
      blockId,
      parsed.data.instruction
    );
    return NextResponse.json(proposals, { status: 200 });
  } catch (error) {
    if (error instanceof AiRateLimitError) {
      return NextResponse.json({ error: "Trop de propositions demandees, reessaie dans quelques minutes." }, { status: 429 });
    }
    throw error;
  }
}
