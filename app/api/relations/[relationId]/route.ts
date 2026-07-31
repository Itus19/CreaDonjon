import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { removeRelation } from "@/src/server/services/relations";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ relationId: string }> }
) {
  const { relationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  await removeRelation(supabase, relationId);
  return new NextResponse(null, { status: 204 });
}
