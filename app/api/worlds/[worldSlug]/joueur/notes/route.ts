import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { loadNotebookWorkspace } from "@/src/server/services/sharedNotes";

const zParams = z.object({ worldSlug: z.string().regex(/^[a-z0-9-]{1,120}$/) });

/**
 * ADR 0120 (V3.2-58) — Le cahier de notes de CE compte, pour le volet de
 * consultation de l'écran de jeu : la même lecture que la page
 * `/joueur/notes` (`loadNotebookWorkspace`, bornée par la RLS du bloc-notes à
 * son autrice et aux notes partagées de la table). Lu à l'ouverture de
 * l'entrée Notes seulement (docs/CABLAGE.md, cas « à la demande »).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });

  const supabase = await createClient();
  const [world, user] = await Promise.all([getWorldBySlug(supabase, parsed.data.worldSlug), getAuthUser(supabase)]);
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  if (!world) return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });

  const notebook = await loadNotebookWorkspace(supabase, { worldId: world.id, userId: user.id });
  return NextResponse.json(notebook, { status: 200 });
}
