import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBackgroundImageBinaryForOwner } from "@/src/server/services/backgroundImages";

/**
 * Sert l'image de fond d'un televersement personnel (V2-G4 reformule,
 * correction qualite) — jamais embarquee en data URL dans le HTML (contrairement
 * a la miniature de la grille) : `Cache-Control: immutable` est correct
 * puisqu'une ligne `background_images` n'est jamais modifiee, seulement
 * creee ou supprimee. RLS (via `getBackgroundImageBinaryForOwner`) refuse
 * deja l'acces a l'image d'un autre compte — 404 dans les deux cas
 * (absente ou pas la sienne), jamais distingue.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const image = await getBackgroundImageBinaryForOwner(supabase, id);
  if (!image) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
