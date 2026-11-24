import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REMOTE_ERRORS } from "@/lib/remote/erreurs";
import { markRemoteRead } from "@/src/server/services/remotePlay";

const zParams = z.object({ campaignId: z.string().uuid() });
const zBody = z.object({ seq: z.number().int().min(0).max(10_000_000) }).strict();

/** ADR 0103 — note le dernier message lu (« depuis ta dernière visite », compteur de l'onglet). Jamais en arrière. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const parsed = zBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const result = await markRemoteRead(supabase, { campaignId: parsedParams.data.campaignId, userId: user.id, seq: parsed.data.seq });
  if (!result.ok) {
    const { status, error } = REMOTE_ERRORS[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
