import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reorderSessionJournalSchema } from "@/lib/entities/schemas";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { reorderSessionJournal } from "@/src/server/services/sessionJournal";

/**
 * AG-13 — ordre des pages du Livre de sessions (glisser-déposer du sommaire
 * du MJ). La liste entière à chaque dépôt ; le service vérifie le MJ et que
 * la liste est exactement celle des pages du monde.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = reorderSessionJournalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });

  const result = await reorderSessionJournal(supabase, { worldId: world.id, userId: user.id, order: parsed.data.order });
  if (!result.ok) {
    return result.reason === "forbidden"
      ? NextResponse.json({ error: "Réservé au MJ." }, { status: 403 })
      : NextResponse.json({ error: "La liste ne correspond plus aux pages du Livre : rechargez la page." }, { status: 409 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
