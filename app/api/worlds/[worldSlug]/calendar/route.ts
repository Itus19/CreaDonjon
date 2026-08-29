import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateCalendarSchema } from "@/lib/worlds/schemas";
import { getCalendar, getWorldBySlug, updateCalendar } from "@/src/server/services/worlds";

/**
 * Calendrier du monde (V2-H2, onglet MJ) : un seul JSON par monde, remplace
 * en entier a chaque depot — meme profil que `entity-kind-order`.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }
  const calendar = await getCalendar(supabase, world.id);
  return NextResponse.json({ calendar }, { status: 200 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateCalendarSchema.safeParse(body);
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

  await updateCalendar(supabase, world.id, parsed.data);
  return NextResponse.json({ ok: true }, { status: 200 });
}
