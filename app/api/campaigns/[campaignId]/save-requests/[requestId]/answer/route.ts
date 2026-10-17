import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { answerSaveRequestSchema } from "@/lib/saveRequests/schemas";
import { answerSaveRequest, type AnswerSaveRequestResult } from "@/src/server/services/saveRequests";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ campaignId: z.string().uuid(), requestId: z.string().uuid() });

const MESSAGES: Record<Extract<AnswerSaveRequestResult, { ok: false }>["reason"], { status: number; error: string }> = {
  not_found: { status: 404, error: "Demande introuvable." },
  not_pending: { status: 409, error: "Cette sauvegarde a déjà sa réponse." },
  invalid_effect: { status: 500, error: "Effet de la demande illisible." },
  no_target: { status: 404, error: "Cible introuvable." },
  refused: { status: 403, error: "Cette sauvegarde ne t'est pas demandée." },
};

/**
 * V3.1-111 (ADR 0044) — répondre à une sauvegarde : le joueur de la cible ou
 * le MJ. La barrière est `public.answer_save_request` (une seule réponse, du
 * bon compte) ; l'issue est appliquée au nom de celui qui répond.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; requestId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = answerSaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const result = await answerSaveRequest(supabase, {
    campaignId: parsedParams.data.campaignId,
    requestId: parsedParams.data.requestId,
    callerId: user.id,
    locale: (await getLocale()) as Locale,
    input: parsed.data,
  });
  if (!result.ok) {
    const { status, error } = MESSAGES[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
