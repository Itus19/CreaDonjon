import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteOwnBackgroundImage } from "@/src/server/services/backgroundImages";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const deleted = await deleteOwnBackgroundImage(supabase, id);
  if (!deleted) {
    return NextResponse.json({ error: "Image introuvable, ou vous n'en êtes pas propriétaire." }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
