import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { duplicateEntity } from "@/src/server/services/entities";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const copy = await duplicateEntity(supabase, { id, duplicatedBy: user.id });
  if (!copy) {
    return NextResponse.json({ error: "Entite introuvable." }, { status: 404 });
  }

  return NextResponse.json(copy, { status: 201 });
}
