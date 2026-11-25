import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deleteAiProvider, updateAiProvider } from "@/src/server/repos/aiProviders";
import { fournisseurCorpsSchema, preparerSecret, refusAdresse, vueFournisseur } from "@/src/server/services/aiProviders";

/** ADR 0108 — modifier ou retirer UN fournisseur de l'appelant. La RLS refuse celui d'un autre. */

const paramsSchema = z.object({ id: z.string().uuid() });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = paramsSchema.safeParse(await params);
  if (!p.success) return NextResponse.json({ error: "Fournisseur introuvable." }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const parsed = fournisseurCorpsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });

  const refus = refusAdresse(parsed.data.baseUrl);
  if (refus) return NextResponse.json({ error: refus }, { status: 400 });

  const secret = preparerSecret(parsed.data.secret);
  if (!secret.ok) return NextResponse.json({ error: secret.error }, { status: 503 });

  const ligne = await updateAiProvider(supabase, {
    userId: user.id,
    id: p.data.id,
    label: parsed.data.label,
    baseUrl: parsed.data.baseUrl,
    models: parsed.data.models,
    ...(secret.secret === undefined ? {} : { secret: secret.secret }),
  });
  if (!ligne) return NextResponse.json({ error: "Fournisseur introuvable." }, { status: 404 });
  // Jamais `ligne.secret` dans la réponse.
  return NextResponse.json({ fournisseur: vueFournisseur(ligne) });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = paramsSchema.safeParse(await params);
  if (!p.success) return NextResponse.json({ error: "Fournisseur introuvable." }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  await deleteAiProvider(supabase, user.id, p.data.id);
  return new NextResponse(null, { status: 204 });
}
