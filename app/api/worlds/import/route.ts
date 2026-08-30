import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importWorldSchema } from "@/lib/worlds/schemas";
import { importWorld } from "@/src/server/services/worldExport";
import { isSuperadmin } from "@/src/server/services/account";

/** Import d'un monde depuis un fichier JSON exporte (V2-G1, dernier point) — cree un monde et sa campagne, jamais une ecriture dans un monde existant. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = importWorldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Fichier invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  // V2-M2 (Lot M) : le mode choisi a l'import est libre (independant du
  // mode d'origine du fichier exporte) — sans ce verrou, importer n'importe
  // quel monde en solo serait une quatrieme facon de contourner le mode
  // reserve au superadmin.
  if (parsed.data.mode === "solo" && !(await isSuperadmin(supabase, user.id))) {
    return NextResponse.json({ error: "Le mode solo est réservé au superadmin." }, { status: 403 });
  }

  try {
    const result = await importWorld(supabase, { ownerId: user.id, mode: parsed.data.mode, data: parsed.data.data });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Echec de l'import." }, { status: 400 });
  }
}
