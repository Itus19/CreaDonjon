import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reorderEntitySchema } from "@/lib/entities/schemas";
import { reorderEntity } from "@/src/server/services/entities";

/**
 * Route dediee au reordonnancement (V2-G9, glisser-depose dans la sidebar) :
 * une seule colonne modifiee, jamais la liste entiere renumerotee — copie de
 * app/api/blocks/[blockId]/order/route.ts.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = reorderEntitySchema.safeParse(body);
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

  const result = await reorderEntity(supabase, {
    id,
    expectedVersion: parsed.data.version,
    displayOrder: parsed.data.displayOrder,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Cette fiche a ete modifiee entre-temps. Rechargez avant de reessayer." },
      { status: 409 }
    );
  }

  return NextResponse.json(result.entity, { status: 200 });
}
