import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ruleEntryBlocksSchema } from "@/lib/characterCreator/ruleEntryBlocksSchema";
import { getRuleEntryPageData } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";

export interface RuleEntryBlocksResponse {
  [key: string]: { blockType: string; data: unknown }[];
}

/**
 * Blocs bruts (description, bases de classe, sous-classe, historique...)
 * d'un lot de fiches de regle — pour l'assistant de creation de personnage,
 * qui doit refleter le contenu reel de la fiche (edite par le MJ) plutot
 * qu'un resume fige. Meme rendu que la page `/regles/[cle]`
 * (`renderBlockData`), pas une deuxieme mise en forme.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = ruleEntryBlocksSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;

  const result: RuleEntryBlocksResponse = {};
  await Promise.all(
    parsed.data.keys.map(async (key) => {
      const detail = await getRuleEntryPageData(supabase, worldSlug, key, locale);
      result[key] = detail ? detail.blocks.map((b) => ({ blockType: b.blockType, data: b.data })) : [];
    })
  );

  return NextResponse.json(result, { status: 200 });
}
