import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applyAiProposal } from "@/src/server/services/aiProposals";

const REASON_STATUS: Record<string, number> = {
  not_found: 404,
  not_pending: 409,
  unsupported_kind: 422,
  block_not_found: 404,
  conflict: 409,
};

/** V3-C5 — corps optionnel : `text` porte le texte MODIFIÉ par l'utilisateur avant d'accepter, absent quand la proposition est acceptée telle quelle. */
const bodySchema = z.object({ text: z.string().min(1).max(400).optional() });

/** Relecture humaine (V1-F3) : ecrit reellement le segment propose, jamais automatique. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const outcome = await applyAiProposal(supabase, { proposalId, userId: user.id, overrideText: parsed.data.text });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.reason }, { status: REASON_STATUS[outcome.reason] ?? 400 });
  }
  return new NextResponse(null, { status: 204 });
}
