import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { replaceHomebrewEntrySchema } from "@/lib/ruleset/schemas";
import { createClient } from "@/lib/supabase/server";
import { getHomebrewEntryForEdit, replaceHomebrewEntry } from "@/src/server/services/rules";

/**
 * Une fiche maison, pour la modifier (V3.1-2). `GET` rend ce qu'il faut
 * pour rouvrir son formulaire ; `PUT` la reecrit en place, meme cle. Seules
 * les fiches qui ont leur `add_entry` dans CE ruleset sont concernees : une
 * fiche heritee ou officielle repond 404 (et la RPC refuserait de toute
 * facon d'ecrire dans une base officielle ou dans la variante d'un autre).
 */
const zParams = z.object({
  rulesetId: z.string().uuid(),
  entryKey: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ rulesetId: string; entryKey: string }> }) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Fiche inconnue." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const entry = await getHomebrewEntryForEdit(supabase, parsed.data);
  if (!entry) {
    return NextResponse.json({ error: "Cette fiche n'est pas une fiche maison de la variante active." }, { status: 404 });
  }
  return NextResponse.json(entry, { status: 200 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ rulesetId: string; entryKey: string }> }) {
  const body = await request.json().catch(() => null);
  const parsed = replaceHomebrewEntrySchema.safeParse({ ...(await params), entry: body });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await replaceHomebrewEntry(supabase, parsed.data);
  if (!result.ok) {
    const error =
      result.reason === "not_found"
        ? "Cette fiche n'est pas une fiche maison de la variante active."
        : result.reason === "type_mismatch"
          ? "Le type d'une fiche ne change pas."
          : (result.message ?? "Fiche invalide.");
    return NextResponse.json({ error }, { status: result.reason === "not_found" ? 404 : 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
