import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addPersonalityEventSchema } from "@/lib/blocks/schemas";
import { addPersonalityEvent } from "@/src/server/services/psyche";
import { canWritePoleBlock } from "@/src/server/services/psycheAccess";
import { z } from "zod";

const zParams = z.object({ blockId: z.string().uuid() });

/**
 * Ajoute un souvenir a un bloc `personality` (V2-H1) — journalise ET
 * applique les deltas aux poles concernes, meme route pour un curseur
 * deplace a la main (le client genere alors un `summary` par defaut) et
 * pour un vrai souvenir raconte.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const { blockId } = parsedParams.data;

  const body = await request.json().catch(() => null);
  const parsed = addPersonalityEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  // La RLS laissait tout membre du monde écrire les pôles d'une fiche (règle 22).
  if (!(await canWritePoleBlock(supabase, { blockId, userId: user.id }))) {
    return NextResponse.json({ error: "Vous ne pouvez pas modifier cette fiche." }, { status: 403 });
  }

  const result = await addPersonalityEvent(supabase, {
    blockId,
    expectedVersion: parsed.data.version,
    summary: parsed.data.summary,
    deltas: parsed.data.deltas,
    occurredAtIngame: parsed.data.occurredAtIngame,
    origin: "gm",
    actorUserId: user.id,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Bloc introuvable." }, { status: 404 });
    }
    if (result.reason === "wrong_block_type") {
      return NextResponse.json({ error: "Ce bloc n'est pas une personnalité." }, { status: 400 });
    }
    if (result.reason === "unknown_pole") {
      return NextResponse.json({ error: "Pôle inconnu." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Ce bloc a été modifié entre-temps. Rechargez avant de réessayer." },
      { status: 409 }
    );
  }

  return NextResponse.json({ block: result.block, event: result.event }, { status: 200 });
}
