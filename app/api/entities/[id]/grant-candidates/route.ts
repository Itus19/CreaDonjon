import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listGrantCandidatesForEntity } from "@/src/server/services/entityGrants";

const REASON_STATUS = { not_found: 404, forbidden: 403 } as const;
const REASON_MESSAGE = {
  not_found: "Fiche introuvable.",
  forbidden: "Reserve au MJ de ce monde.",
} as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await listGrantCandidatesForEntity(supabase, { entityId, callerId: user.id });
  if (!result.ok) {
    return NextResponse.json({ error: REASON_MESSAGE[result.reason] }, { status: REASON_STATUS[result.reason] });
  }
  return NextResponse.json({ candidates: result.candidates }, { status: 200 });
}
