import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { pinRuleToNotebook } from "@/src/server/services/notebookPin";

const bodySchema = z.object({ key: z.string().trim().min(1).max(200) }).strict();

/**
 * V3.1-94 — Épingle une règle dans le cahier PRIVÉ de l'appelant, pour ce
 * monde. Tout compte authentifié membre du monde a son cahier (la RLS des
 * blocs `user` le borne à son auteur) ; une règle n'est qu'un raccourci par
 * sa clé, aucune donnée de règle n'est copiée.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });

  const result = await pinRuleToNotebook(supabase, { worldId: world.id, userId: user.id, ruleKey: parsed.data.key });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason === "conflict" ? "Le cahier a changé entre-temps ; réessaie." : "Épinglage impossible." }, { status: 409 });
  }
  return NextResponse.json(result, { status: 200 });
}
