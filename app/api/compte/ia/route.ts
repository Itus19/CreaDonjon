import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifierUrlFournisseur, type RaisonUrlRefusee } from "@/src/core/ai/providerUrl";
import { deleteAiProvider, getAiProvider, upsertAiProvider } from "@/src/server/repos/aiProviders";
import { chiffrementDisponible, chiffrerSecret } from "@/src/server/ai/secrets";
import { adressesPriveesAutorisees } from "@/src/server/ai/resolveProvider";

/**
 * V3.1-224 (ADR 0103) — le fournisseur d'IA de l'appelant.
 *
 * **La clé ne revient jamais**, pas même à son propriétaire : la réponse dit
 * qu'il y en a une et depuis quand, jamais sa valeur. Un champ pré-rempli la
 * remettrait dans le HTML de la page, donc dans le cache du navigateur et
 * dans n'importe quelle capture d'écran.
 *
 * L'écriture passe par le client authentifié : la RLS de `ai_providers`
 * (`user_id = auth.uid()`) est la barrière, ces lignes ne la doublent pas.
 */

const corpsSchema = z.object({
  label: z.string().trim().min(1).max(60),
  baseUrl: z.string().trim().min(8).max(300),
  model: z.string().trim().min(1).max(120),
  /** Absent : on garde la clé en place. `null` : on la retire. Une chaîne : on la remplace. */
  secret: z.string().min(8).max(500).nullable().optional(),
});

const REFUS_URL: Record<RaisonUrlRefusee, string> = {
  illisible: "Cette adresse n'en est pas une. Elle doit commencer par https:// et finir par le chemin de l'API (souvent /v1).",
  schema: "Seules les adresses http et https sont acceptées.",
  http: "En ligne, l'adresse doit être en https — une clé d'API ne voyage pas en clair.",
  privee: "Cette adresse désigne une machine du réseau local, que le serveur ne peut pas joindre pour toi. Passe par un tunnel, qui te donnera une adresse publique.",
  identifiants: "Retire le nom d'utilisateur et le mot de passe de l'adresse : la clé se saisit dans son propre champ.",
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const ligne = await getAiProvider(supabase, user.id);
  return NextResponse.json({
    fournisseur: ligne
      ? { label: ligne.label, baseUrl: ligne.base_url, model: ligne.model, aUneCle: ligne.secret !== null, posePar: ligne.updated_at }
      : null,
    chiffrementDisponible: chiffrementDisponible(),
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const parsed = corpsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });

  const verdict = verifierUrlFournisseur(parsed.data.baseUrl, { adressesPriveesAutorisees: adressesPriveesAutorisees() });
  if (!verdict.ok) return NextResponse.json({ error: REFUS_URL[verdict.raison] }, { status: 400 });

  // Chiffré AVANT de quitter ce processus (ADR 0103) : la base ne voit jamais la valeur en clair.
  let secret: string | null | undefined;
  if (parsed.data.secret === undefined) secret = undefined;
  else if (parsed.data.secret === null) secret = null;
  else {
    if (!chiffrementDisponible()) {
      return NextResponse.json({ error: "AI_SECRETS_KEY n'est pas posée sur le serveur : une clé ne peut pas être enregistrée en sécurité." }, { status: 503 });
    }
    secret = chiffrerSecret(parsed.data.secret);
  }

  const ligne = await upsertAiProvider(supabase, {
    userId: user.id,
    label: parsed.data.label,
    baseUrl: parsed.data.baseUrl,
    model: parsed.data.model,
    ...(secret === undefined ? {} : { secret }),
  });
  // Jamais `ligne.secret` dans la réponse.
  return NextResponse.json({ fournisseur: { label: ligne.label, baseUrl: ligne.base_url, model: ligne.model, aUneCle: ligne.secret !== null, posePar: ligne.updated_at } });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  await deleteAiProvider(supabase, user.id);
  return new NextResponse(null, { status: 204 });
}
