import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { promoteTimelineEntrySchema } from "@/lib/blocks/schemas";
import { promoteTimelineEntry } from "@/src/server/services/timeline";

/** Promeut une entree de timeline en entite `event` (V2-H2, specs/wiki-blocs.md §3) — le resume part dans la nouvelle fiche, date et titre restent sur l'entree. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = promoteTimelineEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await promoteTimelineEntry(supabase, {
    blockId,
    entryId: parsed.data.entryId,
    expectedVersion: parsed.data.version,
    createdBy: user.id,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Bloc ou entrée introuvable." }, { status: 404 });
    }
    if (result.reason === "already_promoted") {
      return NextResponse.json({ error: "Cette entrée a déjà été promue." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Ce bloc a été modifié entre-temps. Rechargez avant de réessayer." },
      { status: 409 }
    );
  }

  return NextResponse.json({ entity: result.entity, block: result.block }, { status: 200 });
}
