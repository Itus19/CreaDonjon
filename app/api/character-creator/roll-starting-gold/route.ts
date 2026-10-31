import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lancerOrDeDepart, zLancerOrDeDepart } from "@/lib/characterCreator/orDeDepart";
import { serverRng } from "@/src/server/services/rng";

/**
 * Or de départ à haut niveau (V3.1-53) : les dés du palier lancés par le
 * serveur, même motif que `/api/character-creator/roll-hp` (règle 8). Le
 * multiplicateur et la somme fixe sont appliqués côté client par le noyau
 * (`startingGold`), comme le reste de l'assistant de création.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = zLancerOrDeDepart.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  return NextResponse.json({ rolls: lancerOrDeDepart(parsed.data, serverRng) }, { status: 200 });
}
