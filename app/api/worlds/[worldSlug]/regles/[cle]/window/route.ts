import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRuleEntryPageData } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";

/** Donnees d'une fiche de regle pour une fenetre secondaire ouverte via `?avec=` (ADR-0011). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ worldSlug: string; cle: string }> }
) {
  const { worldSlug, cle } = await params;
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const entry = await getRuleEntryPageData(supabase, worldSlug, cle, locale);
  if (!entry) {
    return NextResponse.json({ error: "Fiche de regle introuvable." }, { status: 404 });
  }
  return NextResponse.json(entry, { status: 200 });
}
