import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rejectAiProposal } from "@/src/server/services/aiProposals";

const REASON_STATUS: Record<string, number> = {
  not_found: 404,
  not_pending: 409,
};

export async function POST(_request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const outcome = await rejectAiProposal(supabase, { proposalId, userId: user.id });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.reason }, { status: REASON_STATUS[outcome.reason] ?? 400 });
  }
  return new NextResponse(null, { status: 204 });
}
