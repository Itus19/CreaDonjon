import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldviewEvents } from "@/src/server/services/psyche";

/** Les 20 derniers souvenirs de convictions d'une entite (V2-H1), pour le tableau du bloc `worldview`. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;
  const supabase = await createClient();
  const events = await getWorldviewEvents(supabase, entityId);
  return NextResponse.json(events, { status: 200 });
}
