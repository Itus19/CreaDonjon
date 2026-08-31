import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteRadioStation } from "@/src/server/repos/radioStations";

/** Suppression d'une station (MJ uniquement) — RLS `world_radio_stations_delete` est la seule vraie barriere ; `deleteRadioStation` distingue une ligne hors de portee (0 ligne) d'une erreur pour renvoyer 404 plutot qu'un faux succes. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string; id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const deleted = await deleteRadioStation(supabase, id);
  if (!deleted) {
    return NextResponse.json({ error: "Station introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
