import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REMOTE_ERRORS } from "@/lib/remote/erreurs";
import { cancelRemoteRoll } from "@/src/server/services/remotePlay";

const zParams = z.object({ campaignId: z.string().uuid(), requestId: z.string().uuid() });

/** ADR 0103 — le MJ retire une demande de jet qui n'a pas encore de réponse. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; requestId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const result = await cancelRemoteRoll(supabase, { campaignId: parsedParams.data.campaignId, requestId: parsedParams.data.requestId, userId: user.id });
  if (!result.ok) {
    const { status, error } = REMOTE_ERRORS[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
