import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateMapLayerSchema } from "@/lib/mapLayers/schemas";
import { deleteMapLayer, updateMapLayer } from "@/src/server/services/mapLayers";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ layerId: string }> }) {
  const { layerId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateMapLayerSchema.safeParse(body);
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

  const result = await updateMapLayer(supabase, {
    id: layerId,
    userId: user.id,
    name: parsed.data.name,
    displayOrder: parsed.data.displayOrder,
    visibilityLevel: parsed.data.visibility?.level,
    visibilityScopeId: parsed.data.visibility?.scopeId,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Couche introuvable." }, { status: 404 });
    }
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier cette carte." }, { status: 403 });
  }

  return NextResponse.json(result.layer, { status: 200 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ layerId: string }> }) {
  const { layerId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await deleteMapLayer(supabase, { id: layerId, userId: user.id });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Couche introuvable." }, { status: 404 });
    }
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier cette carte." }, { status: 403 });
  }

  return new NextResponse(null, { status: 204 });
}
