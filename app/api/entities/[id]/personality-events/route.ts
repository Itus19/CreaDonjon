import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { getPersonalityEvents } from "@/src/server/services/psyche";
import { canReadPoleEvents } from "@/src/server/services/psycheAccess";

const zParams = z.object({ id: z.string().uuid() });

/** Les 20 derniers souvenirs d'un bloc `personality` (V2-H1), pour le tableau sous le radar. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const entityId = parsed.data.id;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  // La RLS ne connaît que l'appartenance au monde : un joueur ne lit que les souvenirs d'un bloc qu'il voit (règle 5).
  // Refus : la même réponse qu'un journal vide, rien ne trahit qu'il existe.
  if (!(await canReadPoleEvents(supabase, { entityId, blockType: "personality", userId: user.id }))) {
    return NextResponse.json([], { status: 200 });
  }
  const events = await getPersonalityEvents(supabase, entityId);
  return NextResponse.json(events, { status: 200 });
}
