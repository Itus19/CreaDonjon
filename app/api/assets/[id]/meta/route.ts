import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetById } from "@/src/server/repos/assets";

/** Metadonnees d'un asset (Lot I) — largeur/hauteur necessaires au canevas de carte pour convertir un cadrage normalise en pixels ecran, sans jamais charger l'image elle-meme juste pour ça. Meme garde que `/api/assets/[id]` (RLS `assets_select`, deja filtree par visibilite). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const asset = await getAssetById(supabase, id);
  if (!asset) {
    return NextResponse.json({ error: "Asset introuvable." }, { status: 404 });
  }
  return NextResponse.json(asset, { status: 200 });
}
