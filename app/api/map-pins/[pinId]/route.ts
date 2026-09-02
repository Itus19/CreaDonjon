import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateMapPinSchema } from "@/lib/mapPins/schemas";
import { deleteMapPin, updateMapPin } from "@/src/server/services/mapPins";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ pinId: string }> }) {
  const { pinId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateMapPinSchema.safeParse(body);
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

  const result = await updateMapPin(supabase, {
    id: pinId,
    userId: user.id,
    x: parsed.data.x,
    y: parsed.data.y,
    label: parsed.data.label,
    ref: parsed.data.ref,
    size: parsed.data.size,
    layerId: parsed.data.layerId,
    visibilityLevel: parsed.data.visibility?.level,
    visibilityScopeId: parsed.data.visibility?.scopeId,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Punaise introuvable." }, { status: 404 });
    }
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier cette carte." }, { status: 403 });
  }

  return NextResponse.json(result.pin, { status: 200 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ pinId: string }> }) {
  const { pinId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await deleteMapPin(supabase, { id: pinId, userId: user.id });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Punaise introuvable." }, { status: 404 });
    }
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier cette carte." }, { status: 403 });
  }

  return new NextResponse(null, { status: 204 });
}
