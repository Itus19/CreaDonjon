import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { portraitLayoutSchema } from "@/lib/entities/schemas";
import { setPortraitLayout } from "@/src/server/services/entityPortraits";

/**
 * Taille/alignement du portrait dans le wiki (V2-G11) : un seul proprietaire
 * (le GM), aucune version a verifier — meme convention que
 * setWorldWikiWelcomeMessage (src/server/repos/worlds.ts).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = portraitLayoutSchema.safeParse(body);
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

  await setPortraitLayout(supabase, id, parsed.data);
  return NextResponse.json({ ok: true }, { status: 200 });
}
