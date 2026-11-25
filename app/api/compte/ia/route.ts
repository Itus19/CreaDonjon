import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { countAiProviders, insertAiProvider, listAiProvidersWithChoice, MAX_FOURNISSEURS_PAR_COMPTE, setAiProviderChoice } from "@/src/server/repos/aiProviders";
import { fournisseurCorpsSchema, lireFournisseursIa, preparerSecret, refusAdresse, vueFournisseur } from "@/src/server/services/aiProviders";

/**
 * V3.1-224 (ADR 0103), ADR 0108 — les fournisseurs d'IA de l'appelant.
 *
 * **La clé ne revient jamais**, pas même à son propriétaire : la réponse dit
 * qu'il y en a une et depuis quand, jamais sa valeur.
 *
 * L'écriture passe par le client authentifié : la RLS (`user_id = auth.uid()`)
 * est la barrière, ces lignes ne la doublent pas.
 */

/** Lu par la page Compte et par l'écran du solo, une fois à l'ouverture. Une requête (docs/QUOTAS.md). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  return NextResponse.json(await lireFournisseursIa(supabase, user.id));
}

/** Ajoute un fournisseur. Le premier du compte devient celui qui sert. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const parsed = fournisseurCorpsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });

  const refus = refusAdresse(parsed.data.baseUrl);
  if (refus) return NextResponse.json({ error: refus }, { status: 400 });

  if ((await countAiProviders(supabase, user.id)) >= MAX_FOURNISSEURS_PAR_COMPTE) {
    return NextResponse.json({ error: `${MAX_FOURNISSEURS_PAR_COMPTE} fournisseurs au plus par compte.` }, { status: 400 });
  }

  const secret = preparerSecret(parsed.data.secret);
  if (!secret.ok) return NextResponse.json({ error: secret.error }, { status: 503 });

  const ligne = await insertAiProvider(supabase, {
    userId: user.id,
    label: parsed.data.label,
    baseUrl: parsed.data.baseUrl,
    models: parsed.data.models,
    secret: secret.secret ?? null,
  });

  const { choice } = await listAiProvidersWithChoice(supabase, user.id);
  if (!choice) await setAiProviderChoice(supabase, { userId: user.id, providerId: ligne.id, model: ligne.models[0]! });

  return NextResponse.json({ fournisseur: vueFournisseur(ligne) }, { status: 201 });
}
