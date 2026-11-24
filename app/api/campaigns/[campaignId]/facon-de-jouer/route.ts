import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { zPlayStyle } from "@/src/core/remote/feed";
import { writePlayStyle } from "@/src/server/services/tableSettings";

const zParams = z.object({ campaignId: z.string().uuid() });
/** `confirmed` : l'écran a demandé confirmation. Sans lui, la route refuse : un changement de mode n'arrive jamais au passage. */
const zBody = z.object({ playStyle: zPlayStyle, confirmed: z.literal(true) }).strict();

/** ADR 0103 — la façon de jouer d'une campagne, changée par le MJ seul, après confirmation. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const parsed = zBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const result = await writePlayStyle(supabase, { userId: user.id, campaignId: parsedParams.data.campaignId, playStyle: parsed.data.playStyle });
  if (result === "forbidden") return NextResponse.json({ error: "Réservé au MJ de la campagne." }, { status: 403 });
  if (result === "not_found") return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  return NextResponse.json({ playStyle: result.play_style }, { status: 200 });
}
