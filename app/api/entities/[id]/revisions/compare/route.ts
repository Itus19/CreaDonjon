import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntityById } from "@/src/server/repos/entities";
import { compareRevisionsForViewer } from "@/src/server/services/entityHistory";
import { revisionsCompareQuerySchema, searchParamsToObject } from "@/lib/queryParams/schemas";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;
  const parsedQuery = revisionsCompareQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "Parametres invalides." }, { status: 400 });
  }
  const { from, to } = parsedQuery.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const entity = await getEntityById(supabase, entityId);
  if (!entity) {
    return NextResponse.json({ error: "Entite introuvable." }, { status: 404 });
  }

  const diff = await compareRevisionsForViewer(supabase, entity.world_id, entityId, from, to, user.id);
  if (!diff) {
    return NextResponse.json({ error: "Revision introuvable." }, { status: 404 });
  }

  return NextResponse.json(diff, { status: 200 });
}
