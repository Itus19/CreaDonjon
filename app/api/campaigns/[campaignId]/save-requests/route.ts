import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listMyPendingSaveRequests } from "@/src/server/services/saveRequests";

const zParams = z.object({ campaignId: z.string().uuid() });

/**
 * V3.1-111 (ADR 0044) — les sauvegardes en attente que l'appelant voit : les
 * siennes (joueur de la cible, auteur), toutes pour le MJ (RLS
 * `save_requests_select`). Une lecture par appel (QUOTAS Q1) ; l'écran qui
 * la consommera écoutera la table plutôt que de sonder.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const requests = await listMyPendingSaveRequests(supabase, parsed.data.campaignId);
  return NextResponse.json({ requests }, { status: 200 });
}
