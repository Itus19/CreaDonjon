import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listOwnBackgroundImages, uploadBackgroundImage } from "@/src/server/services/backgroundImages";

/**
 * Bibliotheque personnelle de fonds d'ecran (V2-G4 reformule) : GET liste
 * les images televersees par l'utilisateur courant (les images fournies
 * par l'application sont statiques, `BUILTIN_BACKGROUNDS`, jamais un
 * aller-retour reseau) ; POST en televerse une nouvelle.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const images = await listOwnBackgroundImages(supabase);
  return NextResponse.json({ images }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadBackgroundImage(supabase, { ownerId: user.id, buffer, mimeType: file.type });
  if (!result.ok) {
    const messages = {
      too_large: "Image trop lourde (5 Mo maximum).",
      unsupported_type: "Format non pris en charge (PNG, JPEG ou WebP uniquement).",
    };
    return NextResponse.json({ error: messages[result.reason] }, { status: 400 });
  }

  return NextResponse.json({ image: result.image }, { status: 201 });
}
