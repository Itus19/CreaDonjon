import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEntityById } from "@/src/server/repos/entities";
import { listLinkedWorldviewComparisons, searchWorldviewComparisons } from "@/src/server/services/worldviewComparisons";

const zParams = z.object({ id: z.string().uuid() });
const zQuery = z.object({ q: z.string().trim().max(100).optional() });

/**
 * V3.1-70 — « Comparer avec » du bloc Convictions. Sans `q` : les factions
 * reliées à la fiche ; avec `q` : la recherche « Autre… ». Dans les deux cas,
 * seules partent les convictions d'un bloc visible du lecteur (règle 5,
 * `worldviewComparisons.ts`). La fiche elle-même doit être lisible
 * (RLS) : sinon 404, comme si elle n'existait pas.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const parsedQuery = zQuery.safeParse({ q: request.nextUrl.searchParams.get("q") ?? undefined });
  if (!parsedQuery.success) return NextResponse.json({ error: "Recherche invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const entity = await getEntityById(supabase, parsedParams.data.id);
  if (!entity) return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });

  const base = { worldId: entity.world_id, entityId: entity.id, userId: user.id };
  const q = parsedQuery.data.q;
  const comparisons = q ? await searchWorldviewComparisons(supabase, { ...base, query: q }) : await listLinkedWorldviewComparisons(supabase, base);
  return NextResponse.json({ comparisons }, { status: 200 });
}
