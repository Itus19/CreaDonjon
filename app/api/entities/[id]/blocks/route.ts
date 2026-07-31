import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBlockSchema } from "@/lib/blocks/schemas";
import { createBlock } from "@/src/server/services/blocks";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Corps invalide." },
      { status: 400 }
    );
  }
  if (parsed.data.entityId !== entityId) {
    return NextResponse.json({ error: "entityId incoherent avec l'URL." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const block = await createBlock(supabase, {
    entityId,
    blockType: parsed.data.blockType,
    label: parsed.data.label,
    visibilityLevel: parsed.data.visibility.level,
    visibilityScopeId: parsed.data.visibility.scopeId,
    createdBy: user.id,
  });

  return NextResponse.json(block, { status: 201 });
}
