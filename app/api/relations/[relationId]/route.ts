import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { changeRelationVisibility, removeRelation } from "@/src/server/services/relations";
import { zVisibilityInput } from "@/lib/visibility/schemas";
import { z } from "zod";

const patchRelationSchema = z.object({ visibility: zVisibilityInput });

/** V2-H1 phase 5 : « masquer un lien » dans `relations_graph` — un seul champ modifiable, jamais un PATCH generique qui rouvrirait cible/type. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ relationId: string }> }) {
  const { relationId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchRelationSchema.safeParse(body);
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

  await changeRelationVisibility(supabase, relationId, {
    visibilityLevel: parsed.data.visibility.level,
    visibilityScopeId: parsed.data.visibility.scopeId,
  });
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ relationId: string }> }
) {
  const { relationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  await removeRelation(supabase, relationId);
  return new NextResponse(null, { status: 204 });
}
