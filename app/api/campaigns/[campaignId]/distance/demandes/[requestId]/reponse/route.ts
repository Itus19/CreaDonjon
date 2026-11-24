import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REMOTE_ERRORS } from "@/lib/remote/erreurs";
import { zRollAnswerInput } from "@/src/core/remote/feed";
import { answerRemoteRoll } from "@/src/server/services/remotePlay";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ campaignId: z.string().uuid(), requestId: z.string().uuid() });

/** ADR 0103 — la joueuse visée répond : « Lancer » (le serveur lance) ou « J'ai lancé à la main » (son dé recopié). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; requestId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const parsed = zRollAnswerInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const result = await answerRemoteRoll(supabase, {
    campaignId: parsedParams.data.campaignId,
    requestId: parsedParams.data.requestId,
    userId: user.id,
    input: parsed.data,
    locale: (await getLocale()) as Locale,
  });
  if (!result.ok) {
    const { status, error } = REMOTE_ERRORS[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
