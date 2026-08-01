import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateEntitySchema } from "@/lib/entities/schemas";
import { updateEntity } from "@/src/server/services/entities";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateEntitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Corps invalide." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await updateEntity(supabase, {
    id,
    changedBy: user.id,
    expectedVersion: parsed.data.version,
    name: parsed.data.name,
    entityKind: parsed.data.entityKind,
    aliases: parsed.data.aliases,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Entite introuvable." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Cette fiche a ete modifiee entre-temps. Rechargez avant de reessayer." },
      { status: 409 }
    );
  }

  return NextResponse.json(result.entity, { status: 200 });
}
