import { NextResponse, type NextRequest } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { jetonDepuisLien, verifierLienSchema } from "@/lib/campaignInvites/lienInvitation";
import { resolveInviteForJoin } from "@/src/server/services/campaignInvites";

/**
 * « Rejoindre une table » de l'accueil (V3.1-35) : le lien collé est-il une
 * invitation valide ? Lecture seule : rien n'est créé ni réclamé ici. Si oui,
 * l'écran part vers `/rejoindre/[jeton]`, le parcours existant (mot de passe,
 * choix du personnage). La réponse ne dit rien d'autre que « valide » : ni le
 * monde, ni le rôle, ni le MJ.
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = verifierLienSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const jeton = jetonDepuisLien(parsed.data.lien);
  if (!jeton) return NextResponse.json({ valide: false }, { status: 200 });
  const resolu = await resolveInviteForJoin(supabase, jeton);
  if (!resolu.ok) return NextResponse.json({ valide: false }, { status: 200 });
  return NextResponse.json({ valide: true, chemin: `/rejoindre/${jeton}` }, { status: 200 });
}
