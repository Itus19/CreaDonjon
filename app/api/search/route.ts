import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchQuerySchema } from "@/lib/search/schemas";
import { searchEntities } from "@/src/server/services/entities";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = searchQuerySchema.safeParse({
    worldId: searchParams.get("worldId"),
    q: searchParams.get("q"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Parametres invalides." },
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

  const results = await searchEntities(supabase, parsed.data.worldId, parsed.data.q);
  return NextResponse.json(results, { status: 200 });
}
