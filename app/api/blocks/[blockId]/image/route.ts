import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getImageAssetIdForBlockAsUser, removeBlockImage } from "@/src/server/services/blockImages";
import { uploadBlockImage } from "@/src/server/services/blockImageUpload";
import { getPublicBlockImageSignedUrl } from "@/src/server/services/publicShare";
import { getSignedAssetUrl, SIGNED_URL_CACHE_HEADER } from "@/src/server/services/storage";
import { fileUploadSchema, formDataToObject } from "@/lib/uploads/schemas";

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

  // Les deux chemins se separent plus tot qu'avant (V2.1-20 lot 2) : le
  // visiteur anonyme resout ET signe cote `publicShare`, jamais avec le client
  // de cette requete. La RLS `assets_select` ne laisse l'anon lire une ligne
  // `assets` que si elle est `public`, et une image de bloc est televersee en
  // `players` — signer ici renvoyait donc 404 a tout visiteur de `/partage`,
  // apres avoir pourtant correctement verifie la visibilite du bloc. Defaut
  // jamais atteint tant que le middleware redirigeait cette route vers /login
  // (corrige dans le meme lot, lib/supabase/middleware.ts).
  if (!user) {
    const publicUrl = await getPublicBlockImageSignedUrl(blockId);
    if (!publicUrl) {
      return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
    }
    return NextResponse.redirect(publicUrl, { headers: { "Cache-Control": SIGNED_URL_CACHE_HEADER } });
  }

  const assetId = await getImageAssetIdForBlockAsUser(supabase, blockId, user.id);
  if (!assetId) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }
  const url = await getSignedAssetUrl(supabase, assetId);
  if (!url) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  return NextResponse.redirect(url, { headers: { "Cache-Control": SIGNED_URL_CACHE_HEADER } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const parsed = formData ? fileUploadSchema.safeParse(formDataToObject(formData)) : null;
  if (!parsed?.success) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  const { file } = parsed.data;

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadBlockImage(supabase, { blockId, buffer, mimeType: file.type, uploadedBy: user.id });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Bloc introuvable." }, { status: 404 });
    }
    const messages = {
      too_large: "Image trop lourde (5 Mo maximum).",
      unsupported_type: "Format non pris en charge (PNG, JPEG ou WebP uniquement).",
invalid_image: "Ce fichier n'est pas une image lisible (PNG, JPEG ou WebP).",
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
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  await removeBlockImage(supabase, blockId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
