import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { correctAppliedNote } from "@/src/server/services/aiProposals";

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
/** Même borne que la note proposée par le modèle (`soloNarrationProposal.ts`) et que « modifier » à l'acceptation. */
const bodySchema = z.object({ text: z.string().trim().min(1).max(400) }).strict();

/**
 * V3.2-22 (ADR 0113) — « Corriger » une note du monde déjà ajoutée au wiki.
 * Droits : la RLS d'`ai_proposals` (membre du monde) pour la lire, et
 * `updateBlockContent` (`canUserEditEntityById`) pour réécrire le bloc.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Proposition invalide." }, { status: 400 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const outcome = await correctAppliedNote(supabase, { proposalId: parsedParams.data.proposalId, userId: user.id, text: parsed.data.text });
  if (!outcome.ok) return NextResponse.json({ error: outcome.reason }, { status: REASON_STATUS[outcome.reason] ?? 400 });
  return new NextResponse(null, { status: 204 });
}
