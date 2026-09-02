import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateMapRegionSchema } from "@/lib/mapRegions/schemas";
import { deleteMapRegion, updateMapRegion } from "@/src/server/services/mapRegions";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateMapRegionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await updateMapRegion(supabase, {
    id: regionId,
    userId: user.id,
    name: parsed.data.name,
    ref: parsed.data.ref,
    shape: parsed.data.shape,
    fillColor: parsed.data.fillColor,
    borderColor: parsed.data.borderColor,
    layerId: parsed.data.layerId,
    fogGated: parsed.data.fogGated,
    visibilityLevel: parsed.data.visibility?.level,
    visibilityScopeId: parsed.data.visibility?.scopeId,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Zone introuvable." }, { status: 404 });
    }
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier cette carte." }, { status: 403 });
  }

  return NextResponse.json(result.region, { status: 200 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await deleteMapRegion(supabase, { id: regionId, userId: user.id });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Zone introuvable." }, { status: 404 });
    }
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier cette carte." }, { status: 403 });
  }

  return new NextResponse(null, { status: 204 });
}
