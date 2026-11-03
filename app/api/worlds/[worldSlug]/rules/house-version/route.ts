import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { createHouseVersion } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";

const bodySchema = z.object({ entryKey: z.string().trim().min(1).max(200) }).strict();

const MESSAGES = {
  no_variant: "Choisis d'abord une variante (« Règles actives ») : une règle officielle ne se modifie jamais.",
  not_found: "Règle introuvable.",
  already: "Cette règle est déjà une fiche maison de ta variante.",
  not_editable: "Ce type de règle n'a pas encore de formulaire : sa version maison ne pourrait pas se modifier.",
  invalid: "La règle n'a pas pu être copiée.",
} as const;

/**
 * V3.1-94 (ADR 0072) — « Créer une version maison » d'une règle officielle :
 * une copie dans la variante active du monde, sous la même clé. Réservé à
 * l'administrateur du monde ; la RPC n'écrit que dans une variante dont
 * l'appelant est le créateur, jamais dans une base officielle (règle 18).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  if (!(await isWorldAdmin(supabase, { worldId: world.id, userId: user.id }))) {
    return NextResponse.json({ error: "Réservé au MJ de ce monde." }, { status: 403 });
  }

  const result = await createHouseVersion(supabase, { worldId: world.id, entryKey: parsed.data.entryKey, locale: (await getLocale()) as Locale });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "invalid" ? 400 : 409;
    return NextResponse.json({ error: MESSAGES[result.reason], reason: result.reason }, { status });
  }
  return NextResponse.json(result, { status: 201 });
}
