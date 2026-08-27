import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getImageForBlockAsUser, removeBlockImage, uploadBlockImage } from "@/src/server/services/blockImages";
import { getPublicBlockImage } from "@/src/server/services/publicShare";

/**
 * Image d'un bloc `image` (V2-G12) : servie a la fois par la fiche
 * d'edition/apercu (authentifie) ET par `/partage` (anonyme) — meme URL
 * dans `data.url` quel que soit le visiteur, la distinction se fait ici,
 * jamais cote client. Contrairement au portrait (public des qu'on voit le
 * nom de la fiche), un bloc a sa propre visibilite : les deux chemins
 * reappliquent `filterBlocks` avant de rendre les octets (jamais un
 * raccourci qui la contournerait).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const image = user
    ? await getImageForBlockAsUser(supabase, blockId, user.id)
    : await getPublicBlockImage(blockId);

  if (!image) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.image), {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=60",
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
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
  const result = await uploadBlockImage(supabase, { blockId, buffer, mimeType: file.type });
  if (!result.ok) {
    const messages = {
      too_large: "Image trop lourde (5 Mo maximum).",
      unsupported_type: "Format non pris en charge (PNG, JPEG ou WebP uniquement).",
    };
    return NextResponse.json({ error: messages[result.reason] }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  await removeBlockImage(supabase, blockId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
