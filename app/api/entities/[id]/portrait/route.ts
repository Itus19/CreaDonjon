import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortraitForEntity, removeEntityPortrait, uploadEntityPortrait } from "@/src/server/services/entityPortraits";

/**
 * Portrait d'une fiche (retour utilisateur) : GET est accessible sans
 * session (RLS `entity_portraits_select using (true)` — un portrait est
 * public comme le nom de la fiche, y compris pour un visiteur anonyme du
 * wiki), POST/DELETE exigent un compte (RLS restreint ensuite l'ecriture
 * aux membres du monde). 404 uniforme (absente / hors de portee) : jamais
 * de distinction affichee, meme convention que le fond d'ecran.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const portrait = await getPortraitForEntity(supabase, id);
  if (!portrait) {
    return NextResponse.json({ error: "Portrait introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(portrait.image), {
    status: 200,
    headers: {
      "Content-Type": portrait.mimeType,
      "Cache-Control": "public, max-age=60",
    },
  });
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
  const result = await uploadEntityPortrait(supabase, { entityId: id, buffer, mimeType: file.type });
  if (!result.ok) {
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
