import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { restoreDeletedEntity } from "@/src/server/services/entities";

/** Rétablit une fiche supprimée (retour utilisateur, Journal d'historique) — symétrique de `DELETE /api/entities/[id]`. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await restoreDeletedEntity(supabase, id);
  if (!result.restored) {
    if (result.error === "forbidden") {
      return NextResponse.json({ error: "Vous n'avez pas le droit de rétablir cette fiche." }, { status: 403 });
    }
    if (result.error === "slug_conflict") {
      return NextResponse.json({ error: "Une autre fiche utilise déjà cette URL, impossible de rétablir." }, { status: 409 });
    }
    return NextResponse.json({ error: "Fiche introuvable ou déjà rétablie." }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
