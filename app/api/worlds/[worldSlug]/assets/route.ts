import { NextResponse, type NextRequest } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { uploadAsset } from "@/src/server/services/storage";
import { assetUploadSchema, formDataToObject } from "@/lib/uploads/schemas";

/** Televersement d'un asset (Lot I, ADR 0017) — RLS `assets_bucket_insert`/`assets_insert` restreignent deja aux membres du monde ; la visibilite demandee reste celle que RLS `assets_write`... (assets_insert) laisse poser, jamais un second controle ici. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const parsed = formData ? assetUploadSchema.safeParse(formDataToObject(formData)) : null;
  if (!parsed?.success) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  const { file, altText, visibilityLevel, maxDimension } = parsed.data;

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadAsset(supabase, {
    worldId: world.id,
    buffer,
    mimeType: file.type,
    altText,
    visibilityLevel,
    visibilityScopeId: null,
    uploadedBy: user.id,
    maxDimension,
  });
  if (!result.ok) {
    const messages = {
      too_large: "Image trop lourde (25 Mo maximum).",
      unsupported_type: "Format non pris en charge (PNG, JPEG ou WebP uniquement).",
invalid_image: "Ce fichier n'est pas une image lisible (PNG, JPEG ou WebP).",
    };
    return NextResponse.json({ error: messages[result.reason] }, { status: 400 });
  }

  return NextResponse.json(result.asset, { status: 201 });
}
