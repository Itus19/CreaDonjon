import { NextResponse, type NextRequest } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { deleteAsset, getSignedAssetUrl } from "@/src/server/services/storage";

/**
 * Sert un asset (Lot I, ADR 0017) — redirige vers une URL signee de courte
 * duree plutot que de streamer les octets ici : le navigateur peut alors
 * utiliser directement `<img src="/api/assets/[id]">`, meme confort que
 * `/api/entities/[id]/portrait`, mais un bucket prive derriere plutot que
 * du bytea. `getSignedAssetUrl` interroge d'abord la ligne `assets` (RLS
 * `assets_select`, deja filtree par visibilite) — jamais storage.objects
 * en direct, dont la porte est volontairement plus large (juste "membre du
 * monde").
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const url = await getSignedAssetUrl(supabase, id);
  if (!url) {
    return NextResponse.json({ error: "Asset introuvable." }, { status: 404 });
  }

  return NextResponse.redirect(url);
}

/** Suppression (Lot I) — retire la ligne ET le fichier du bucket (`deleteAsset`, jamais l'un sans l'autre). RLS `assets_delete` (membre du monde) reste la garde reelle, verifiee ici uniquement via `getAuthUser` pour distinguer "non authentifie" de "hors de portee". */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const deleted = await deleteAsset(supabase, id);
  if (!deleted) {
    return NextResponse.json({ error: "Asset introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
