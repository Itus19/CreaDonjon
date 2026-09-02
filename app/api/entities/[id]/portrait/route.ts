import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortraitAssetId, removeEntityPortrait, uploadEntityPortrait } from "@/src/server/services/entityPortraits";
import { getSignedAssetUrl } from "@/src/server/services/storage";

/**
 * Portrait d'une fiche (Phase F2, Lot I) — un `asset` (Storage) plutot que
 * du bytea, meme interface que les cartes (ADR 0017 decision 3). GET
 * redirige vers une URL signee de courte duree (meme motif que
 * `/api/assets/[id]`) plutot que de streamer les octets ici, accessible
 * sans session (RLS `entity_assets_select_portrait`/`assets_select` —
 * un portrait reste public comme le nom de la fiche, y compris pour un
 * visiteur anonyme du wiki, voir les migrations
 * `20260902110001_assets_public_visibility`/`20260902120001_entity_assets_portrait`).
 * POST/DELETE exigent un compte (RLS restreint ensuite l'ecriture aux
 * membres du monde). 404 uniforme (absente / hors de portee) : jamais de
 * distinction affichee, meme convention que le fond d'ecran.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const assetId = await getPortraitAssetId(supabase, id);
  if (!assetId) {
    return NextResponse.json({ error: "Portrait introuvable." }, { status: 404 });
  }
  const url = await getSignedAssetUrl(supabase, assetId);
  if (!url) {
    return NextResponse.json({ error: "Portrait introuvable." }, { status: 404 });
  }

  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const result = await uploadEntityPortrait(supabase, { entityId: id, buffer, mimeType: file.type, uploadedBy: user.id });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
    }
    const messages = {
      too_large: "Image trop lourde (5 Mo maximum).",
      unsupported_type: "Format non pris en charge (PNG, JPEG ou WebP uniquement).",
    };
    return NextResponse.json({ error: messages[result.reason] }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const removed = await removeEntityPortrait(supabase, id);
  if (!removed) {
    return NextResponse.json({ error: "Portrait introuvable." }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
