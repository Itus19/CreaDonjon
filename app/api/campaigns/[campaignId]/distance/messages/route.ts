import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REMOTE_ERRORS } from "@/lib/remote/erreurs";
import { zRemoteMessageInput } from "@/src/core/remote/feed";
import { postRemoteMessage } from "@/src/server/services/remotePlay";

const zParams = z.object({ campaignId: z.string().uuid() });

/** ADR 0103 — écrire dans le fil : le MJ parle en MJ, un joueur en joueur ; la visibilité est contrôlée par le service puis par la RLS. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const parsed = zRemoteMessageInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const result = await postRemoteMessage(supabase, { campaignId: parsedParams.data.campaignId, userId: user.id, input: parsed.data });
  if (!result.ok) {
    const { status, error } = REMOTE_ERRORS[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(result, { status: 201 });
}
