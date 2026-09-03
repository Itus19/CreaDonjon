import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { drawGeneratorSchema } from "@/lib/blocks/schemas";
import { drawTableSlotsFromGeneratorBlock, type GeneratorResult } from "@/src/server/services/generators";
import { resolveGeneratorProseSlots } from "@/src/server/ai/generatorProse";
import { getOpenAiCompatibleProviderFromEnv } from "@/src/server/ai/adapters/openAiCompatible";
import { AiRateLimitError } from "@/src/server/ai/callAi";
import { renderGeneratorTemplate } from "@/src/core/generators/render";
import { serverRng } from "@/src/server/services/rng";

/**
 * Tirage sur un bloc `generator` (V1-E2/V2-J1, specs/outils-mj.md §3) —
 * `serverRng` (jamais `Math.random()` cote client, CLAUDE.md regle 6), meme
 * discipline que `/api/blocks/[blockId]/draw` (V1-E1). Les emplacements
 * `table` tirent toujours, meme sans fournisseur IA configure — seuls les
 * emplacements `prose` (V2-J1) dependent d'un fournisseur, et restent
 * simplement vides sinon (critere du ticket, jamais un 503 qui casserait le
 * reste du tirage).
 *
 * `onlySlotKey` (V2-J1 Phase 2) : relance un seul emplacement plutot que
 * tout le bloc — `knownSlotTexts` (envoye par le client) fournit les
 * valeurs deja tirees des AUTRES emplacements, reutilisees ici pour
 * recomposer le gabarit complet ET pour le contexte d'un eventuel
 * emplacement `prose` (formatSlotValuesForPrompt voit alors le tableau
 * complet, pas seulement l'emplacement qui vient de changer).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = drawGeneratorSchema.safeParse(body ?? {});
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

  const draw = await drawTableSlotsFromGeneratorBlock(supabase, blockId, serverRng, { onlySlotKey: parsed.data.onlySlotKey ?? undefined });
  if (!draw) {
    return NextResponse.json({ error: "Generateur introuvable." }, { status: 404 });
  }

  const knownSlotTexts = parsed.data.knownSlotTexts;

  let proseTexts: Record<string, string> = {};
  if (draw.proseSlots.length > 0) {
    let provider;
    try {
      provider = getOpenAiCompatibleProviderFromEnv();
    } catch {
      provider = null;
    }
    if (provider) {
      try {
        proseTexts = await resolveGeneratorProseSlots(
          supabase,
          provider,
          { userId: user.id },
          draw.proseSlots,
          { ...knownSlotTexts, ...draw.slotTexts },
          parsed.data.proseLength
        );
      } catch (error) {
        if (error instanceof AiRateLimitError) {
          return NextResponse.json({ error: "Trop de generations demandees, reessaie dans quelques minutes." }, { status: 429 });
        }
        throw error;
      }
    }
  }

  const allSlotTexts = { ...knownSlotTexts, ...draw.slotTexts, ...proseTexts };
  const result: GeneratorResult = {
    text: renderGeneratorTemplate(draw.generator.template, allSlotTexts),
    slots: [...draw.slots, ...draw.proseSlots.map((s) => ({ key: s.key, text: proseTexts[s.key] ?? "", refs: [] }))],
  };
  return NextResponse.json(result, { status: 200 });
}
