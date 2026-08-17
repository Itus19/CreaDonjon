import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createHomebrewWeaponSchema } from "@/lib/ruleset/schemas";
import { createHomebrewWeapon } from "@/src/server/services/rules";

/**
 * Creation d'une arme maison (V1-D4) : POST valide la charge utile via
 * `zWeaponBlockData` (reutilise depuis le schema du bloc de regle, jamais
 * une deuxieme forme concurrente) puis delegue au service, qui ecrit deux
 * surcharges (`add_entry` + `add_block`) via `upsert_ruleset_override` —
 * la meme fonction Postgres qui refuse deja une cible officielle
 * (CLAUDE.md regle 12, verifie cote serveur, pas seulement ici) : le client
 * de ce formulaire n'envoie jamais que le ruleset actif du monde (deja
 * filtre aux variantes de l'utilisateur par le selecteur), donc un refus
 * RPC ici reste un filet de securite, pas un chemin attendu — meme
 * traitement (rethrow, 500 generique) que `app/api/blocks/[blockId]/route.ts`
 * pour toute erreur qui n'est pas une simple validation de forme.
 * `worldSlug` non utilise : une variante appartient a son createur, pas a
 * un monde precis (meme raisonnement que POST /api/worlds/[worldSlug]/ruleset).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  await params;

  const body = await request.json().catch(() => null);
  const parsed = createHomebrewWeaponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  try {
    const created = await createHomebrewWeapon(supabase, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Donnees d'arme invalides." }, { status: 400 });
    }
    throw error;
  }
}
