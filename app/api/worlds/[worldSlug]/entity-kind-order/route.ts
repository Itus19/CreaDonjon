import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reorderEntityKindsSchema } from "@/lib/entities/schemas";
import { getWorldBySlug, updateEntityKindOrder } from "@/src/server/services/worlds";

/**
 * Ordre des categories de la sidebar (V2-G9, glisser-depose) : un tableau
 * JSON unique par monde, remplace en entier a chaque depot — pas de version
 * (meme profil que wiki_welcome_message, contention faible avec un seul MJ).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = reorderEntityKindsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Corps invalide." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  await updateEntityKindOrder(supabase, world.id, parsed.data.order);
  return NextResponse.json({ ok: true }, { status: 200 });
}
