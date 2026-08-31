import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addRadioStationSchema } from "@/lib/radioStations/schemas";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { insertRadioStation, listRadioStationsForWorld } from "@/src/server/repos/radioStations";

/** Panneau radio (extension V2-G3, retour utilisateur : "les stations radio sont celles que le MJ met en place pour ce monde et accessibles aux joueurs") — remplace le `localStorage` de `RadioWidget.tsx`. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [stations, canManage] = await Promise.all([
    listRadioStationsForWorld(supabase, world.id),
    user ? isWorldAdmin(supabase, { worldId: world.id, userId: user.id }) : Promise.resolve(false),
  ]);
  return NextResponse.json({ stations, canManage }, { status: 200 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = addRadioStationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const admin = await isWorldAdmin(supabase, { worldId: world.id, userId: user.id });
  if (!admin) {
    return NextResponse.json({ error: "Reserve au MJ." }, { status: 403 });
  }

  const station = await insertRadioStation(supabase, {
    worldId: world.id,
    label: parsed.data.label,
    url: parsed.data.url,
    createdBy: user.id,
  });
  return NextResponse.json(station, { status: 201 });
}
