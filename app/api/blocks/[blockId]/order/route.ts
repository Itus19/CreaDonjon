import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reorderBlockSchema } from "@/lib/blocks/schemas";
import { reorderBlock } from "@/src/server/services/blocks";

/**
 * Route dediee au reordonnancement (docs/BACKLOG.md V0-04) : une seule
 * colonne modifiee, jamais la liste entiere renumerotee.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  const { blockId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = reorderBlockSchema.safeParse(body);
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

  const result = await reorderBlock(supabase, {
    id: blockId,
    expectedVersion: parsed.data.version,
    displayOrder: parsed.data.displayOrder,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Ce bloc a ete modifie entre-temps. Rechargez avant de reessayer." },
      { status: 409 }
    );
  }

  return NextResponse.json(result.block, { status: 200 });
}
