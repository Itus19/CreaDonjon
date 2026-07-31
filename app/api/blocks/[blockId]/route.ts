import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { updateBlockSchema } from "@/lib/blocks/schemas";
import { deleteBlock, updateBlockContent } from "@/src/server/services/blocks";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  const { blockId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateBlockSchema.safeParse(body);
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

  let result;
  try {
    result = await updateBlockContent(supabase, {
      id: blockId,
      expectedVersion: parsed.data.version,
      display: parsed.data.display,
      data: parsed.data.data,
      visibilityLevel: parsed.data.visibility.level,
      visibilityScopeId: parsed.data.visibility.scopeId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Donnees de bloc invalides." },
        { status: 400 }
      );
    }
    throw error;
  }

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Bloc introuvable." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Ce bloc a ete modifie entre-temps. Rechargez avant de reessayer." },
      { status: 409 }
    );
  }

  return NextResponse.json(result.block, { status: 200 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  const { blockId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  await deleteBlock(supabase, blockId);
  return new NextResponse(null, { status: 204 });
}
