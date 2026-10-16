import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPlayerCombatView } from "@/src/server/services/playerCombatView";

const zParams = z.object({ campaignId: z.string().uuid() });

/**
 * V3.1-102 (ADR 0040) — l'initiative vue par les joueuses : ordre, tour,
 * états ; PV des alliés seulement, un état de blessure pour les adversaires,
 * jamais leur CA. Ouverte à tout membre de la campagne (le MJ a ses propres
 * routes, complètes). `combat: null` : aucun combat en cours.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const view = await getPlayerCombatView(supabase, parsed.data.campaignId);
  if (view.kind === "forbidden") {
    return NextResponse.json({ error: "Réservé aux membres de la campagne." }, { status: 403 });
  }
  if (view.kind === "none") {
    return NextResponse.json({ combat: null, participants: [] }, { status: 200 });
  }
  return NextResponse.json({ combat: view.combat, participants: view.participants }, { status: 200 });
}
