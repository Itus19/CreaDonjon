import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { narrateSpikeTurn } from "@/src/server/ai/spikeSolo";
import { getOpenAiCompatibleProviderFromEnv } from "@/src/server/ai/adapters/openAiCompatible";
import { AiRateLimitError } from "@/src/server/ai/callAi";

const bodySchema = z.object({
  locationText: z.string(),
  characterSummary: z.string(),
  recentEvents: z.array(z.string()),
  mechanicalFact: z.string().nullable(),
  playerAction: z.string().min(1).max(500),
});

/** V2-S1 : un tour de narration. Ne mute jamais rien — l'issue (ok/invalide) est mesuree par l'ecran, pas par ce qui est ecrit en base. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
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
    const outcome = await narrateSpikeTurn(supabase, provider, user.id, parsed.data);
    return NextResponse.json(outcome, { status: 200 });
  } catch (error) {
    if (error instanceof AiRateLimitError) {
      return NextResponse.json({ error: "Trop d'appels, reessaie dans quelques minutes." }, { status: 429 });
    }
    throw error;
  }
}
