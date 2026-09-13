import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMentionedInEntities } from "@/src/server/services/linker";

/**
 * Rétroliens vers une fiche (V2.1-1, panneau "Mentionné dans",
 * specs/wiki-liens-et-personnages.md §A2) — pas de résolution de visibilité
 * ici, la RLS de `entity_mentions` (`entity_mentions_select`) filtre déjà
 * pour l'utilisateur authentifié de CETTE requête.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const mentions = await listMentionedInEntities(supabase, entityId);
  return NextResponse.json(mentions, { status: 200 });
}
