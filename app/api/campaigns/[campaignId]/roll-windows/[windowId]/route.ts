import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rollWindowActionSchema } from "@/lib/rollWindows/schemas";
import { getRollWindow } from "@/src/server/repos/rollWindows";
import { answerRollWindow, continueRollWindow, resumeRollWindow } from "@/src/server/services/rollWindowResume";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ campaignId: z.string().uuid(), windowId: z.string().uuid() });

/**
 * V3.1-160 (ADR 0075) — répondre à une fenêtre de réaction, « Continuer »
 * (le MJ), ou la reprendre (l'auteur du jet). Les barrières sont en base :
 * `answer_roll_window` (sa propre ligne, une fois), `close_roll_window` (tout
 * le monde a répondu, ou le MJ), `engine_resume_roll_window` (l'auteur, une
 * fois, demande signée).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; windowId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = rollWindowActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { campaignId, windowId } = parsedParams.data;
  const row = await getRollWindow(supabase, windowId);
  if (!row || row.campaign_id !== campaignId) return NextResponse.json({ error: "Fenêtre introuvable." }, { status: 404 });
  const locale = (await getLocale()) as Locale;
  const action = parsed.data;

  if (action.action === "resume") {
    if (row.author_user_id !== user.id || row.status !== "closed" || row.resumed_at !== null) {
      return NextResponse.json({ error: "Cette fenêtre ne se reprend pas (pas ton jet, encore ouverte, ou déjà reprise)." }, { status: 409 });
    }
    const resumed = await resumeRollWindow(supabase, { windowId, campaignId, callerId: user.id, locale });
    return NextResponse.json({ ok: true, closed: true, resumed }, { status: 200 });
  }
  const result =
    action.action === "answer"
      ? await answerRollWindow(supabase, { windowId, index: action.index, use: action.use, callerId: user.id, locale })
      : await continueRollWindow(supabase, { windowId, callerId: user.id, locale });
  if (!result.ok) return NextResponse.json({ error: result.reason === "not_found" ? "Fenêtre introuvable." : "Cette réponse ne t'appartient pas, ou la fenêtre est fermée." }, { status: result.reason === "not_found" ? 404 : 403 });
  return NextResponse.json(result, { status: 200 });
}
