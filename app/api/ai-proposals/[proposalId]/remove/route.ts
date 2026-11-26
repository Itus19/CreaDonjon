import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { removeAppliedNote } from "@/src/server/services/aiProposals";

const REASON_STATUS: Record<string, number> = {
  not_found: 404,
  not_applied: 409,
  unsupported_kind: 422,
  block_not_found: 404,
  segment_not_found: 404,
  forbidden: 403,
  conflict: 409,
};

const paramsSchema = z.object({ proposalId: z.string().uuid() });

/**
 * V3.2-22 (ADR 0113) — « Retirer » une note du monde déjà ajoutée au wiki :
 * son paragraphe quitte le bloc, la proposition passe `reverted`. Sans corps.
 * Droits : la RLS d'`ai_proposals` et `updateBlockContent`.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Proposition invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const outcome = await removeAppliedNote(supabase, { proposalId: parsedParams.data.proposalId, userId: user.id });
  if (!outcome.ok) return NextResponse.json({ error: outcome.reason }, { status: REASON_STATUS[outcome.reason] ?? 400 });
  return new NextResponse(null, { status: 204 });
}
