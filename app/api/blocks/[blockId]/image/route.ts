import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getImageAssetIdForBlockAsUser, removeBlockImage, uploadBlockImage } from "@/src/server/services/blockImages";
import { getPublicBlockImageAssetId } from "@/src/server/services/publicShare";
import { getSignedAssetUrl } from "@/src/server/services/storage";

/**
 * Image d'un bloc `image` (V2-G12, V2-L1) : servie a la fois par la fiche
 * d'edition/apercu (authentifie) ET par `/partage` (anonyme) — meme URL
 * dans `data.url` quel que soit le visiteur, la distinction se fait ici,
 * jamais cote client. Contrairement au portrait (public des qu'on voit le
 * nom de la fiche), un bloc a sa propre visibilite : les deux chemins
 * reappliquent `filterBlocks` avant de resoudre l'asset (jamais un
 * raccourci qui la contournerait) — GET redirige ensuite vers une URL
 * signee de courte duree, meme motif que le portrait.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const assetId = user
    ? await getImageAssetIdForBlockAsUser(supabase, blockId, user.id)
    : await getPublicBlockImageAssetId(blockId);
  if (!assetId) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }
  const url = await getSignedAssetUrl(supabase, assetId);
  if (!url) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  return NextResponse.redirect(url);
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
  const result = await uploadBlockImage(supabase, { blockId, buffer, mimeType: file.type, uploadedBy: user.id });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Bloc introuvable." }, { status: 404 });
    }
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
