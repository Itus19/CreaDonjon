import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntityById } from "@/src/server/repos/entities";
import { getRevisionForViewer } from "@/src/server/services/entityHistory";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; number: string }> }
) {
  const { id: entityId, number } = await params;
  const revisionNumber = Number(number);
  if (!Number.isInteger(revisionNumber)) {
    return NextResponse.json({ error: "Numero de revision invalide." }, { status: 400 });
  }

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

  const revision = await getRevisionForViewer(supabase, entity.world_id, entityId, revisionNumber, user.id);
  if (!revision) {
    return NextResponse.json({ error: "Revision introuvable." }, { status: 404 });
  }

  return NextResponse.json(revision, { status: 200 });
}
