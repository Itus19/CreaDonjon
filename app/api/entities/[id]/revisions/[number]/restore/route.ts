import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { restoreRevision } from "@/src/server/services/entityHistory";

export async function POST(
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

  const result = await restoreRevision(supabase, { entityId, revisionNumber, changedBy: user.id });
  if (!result.ok) {
    return NextResponse.json({ error: "Entite ou revision introuvable." }, { status: 404 });
  }

  return NextResponse.json(result.entity, { status: 200 });
}
