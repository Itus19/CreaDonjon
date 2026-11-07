import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listPendingRollWindows } from "@/src/server/repos/rollWindows";

const zParams = z.object({ campaignId: z.string().uuid() });

/**
 * V3.1-160 (ADR 0075) — les fenêtres de réaction ouvertes que l'appelant voit
 * (RLS : l'auteur du jet, ceux qui peuvent réagir, le MJ). Une lecture par
 * appel (QUOTAS Q1) ; l'écran écoute ensuite la table, il ne sonde pas.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const windows = await listPendingRollWindows(supabase, parsed.data.campaignId);
  return NextResponse.json({ windows }, { status: 200 });
}
