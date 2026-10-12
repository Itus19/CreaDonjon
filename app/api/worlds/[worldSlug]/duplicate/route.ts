import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { duplicateWorldSchema } from "@/lib/worlds/schemas";
import { duplicateWorld } from "@/src/server/services/worldExport";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldOwnerId } from "@/src/server/repos/worlds";
import { isSuperadmin } from "@/src/server/services/account";

const paramsSchema = z.object({ worldSlug: z.string().min(1).max(200) });

/**
 * Dupliquer un monde : copier son wiki, et ses images, dans un monde neuf
 * (V2-G1, refait par V3-F3, ADR 0058). Le mode de la copie et le sort des
 * regles sont choisis a chaque fois ; `solo` reste reserve au superadmin,
 * meme verrou qu'a la creation et a l'import.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const parsed = duplicateWorldSchema.safeParse(body);
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

  const world = await getWorldBySlug(supabase, parsedParams.data.worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }
  const ownerId = await getWorldOwnerId(supabase, world.id);
  if (ownerId !== user.id) {
    return NextResponse.json({ error: "Seul le propriétaire du monde peut le dupliquer." }, { status: 403 });
  }
  if (parsed.data.mode === "solo" && !(await isSuperadmin(supabase, user.id))) {
    return NextResponse.json({ error: "Le mode solo est réservé au superadmin." }, { status: 403 });
  }

  try {
    const result = await duplicateWorld(supabase, {
      worldId: world.id,
      ownerId: user.id,
      mode: parsed.data.mode,
      rulesFollow: parsed.data.rulesFollow,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Duplication du monde echouee", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Échec de la duplication." }, { status: 400 });
  }
}
