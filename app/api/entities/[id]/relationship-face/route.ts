import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRelationshipFace } from "@/src/server/services/relationshipFace";

const zParams = z.object({ id: z.string().uuid() });
const zQuery = z.object({ targetId: z.string().uuid() });

/**
 * V3.1-71 — le face-à-face du bloc Relation : ce que la fiche `id` ressent
 * envers `targetId` (portraits, valeurs, nombre de souvenirs). Appelée sens
 * échangé, elle sert « ⇄ Voir l'autre sens » : le bloc inverse ne part que
 * s'il est visible du lecteur (règle 5, `relationshipFace.ts`). Fiche
 * illisible : 404, comme si elle n'existait pas.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const parsedQuery = zQuery.safeParse({ targetId: request.nextUrl.searchParams.get("targetId") ?? undefined });
  if (!parsedQuery.success) return NextResponse.json({ error: "Cible invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const face = await getRelationshipFace(supabase, {
    sourceEntityId: parsedParams.data.id,
    targetEntityId: parsedQuery.data.targetId,
    userId: user.id,
  });
  if (!face) return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
  return NextResponse.json({ face }, { status: 200 });
}
