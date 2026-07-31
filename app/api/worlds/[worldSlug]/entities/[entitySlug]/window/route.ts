import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntityWindowData } from "@/src/server/services/entityWindow";

/** Donnees d'une fenetre secondaire ouverte via `?avec=` (ADR-0006). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ worldSlug: string; entitySlug: string }> }
) {
  const { worldSlug, entitySlug } = await params;
  const supabase = await createClient();
  const data = await getEntityWindowData(supabase, worldSlug, entitySlug);
  if (!data) {
    return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
  }
  return NextResponse.json(data, { status: 200 });
}
