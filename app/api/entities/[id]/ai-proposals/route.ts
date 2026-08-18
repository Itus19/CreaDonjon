import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listPendingAiProposalsForEntity } from "@/src/server/repos/aiProposals";

/** Propositions IA en attente pour une entite (V1-F3) — panneau de relecture. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const proposals = await listPendingAiProposalsForEntity(supabase, entityId);
  return NextResponse.json(proposals, { status: 200 });
}
