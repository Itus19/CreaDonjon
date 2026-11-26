import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAiProviderById, setAiProviderChoice } from "@/src/server/repos/aiProviders";

/**
 * ADR 0108 — le couple (fournisseur, modèle) qui sert, choisi depuis la page
 * Compte ou le menu du solo. Le modèle doit être dans la liste de CE
 * fournisseur ; la RLS refuse un fournisseur qui n'est pas au compte.
 * Coût (docs/QUOTAS.md) : deux requêtes, au clic seulement.
 */

const corpsSchema = z.object({
  fournisseurId: z.string().uuid(),
  model: z.string().trim().min(1).max(120),
});

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const parsed = corpsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const fournisseur = await getAiProviderById(supabase, user.id, parsed.data.fournisseurId);
  if (!fournisseur || !fournisseur.models.includes(parsed.data.model)) {
    return NextResponse.json({ error: "Ce modèle n'est pas dans la liste de ce fournisseur." }, { status: 400 });
  }

  await setAiProviderChoice(supabase, { userId: user.id, providerId: fournisseur.id, model: parsed.data.model });
  return NextResponse.json({ actif: { fournisseurId: fournisseur.id, model: parsed.data.model } });
}
