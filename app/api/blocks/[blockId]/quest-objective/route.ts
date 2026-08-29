import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toggleQuestObjectiveSchema } from "@/lib/blocks/schemas";
import { toggleQuestObjective } from "@/src/server/services/quests";

/**
 * Cocher/decocher un objectif de quete (V2-H4) — route dediee plutot que le
 * `PATCH` generique des blocs : cocher un objectif est un fait de partie,
 * journalise en `session_event` cote service, pas une simple edition
 * redactionnelle silencieuse.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = toggleQuestObjectiveSchema.safeParse(body);
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

  const result = await toggleQuestObjective(supabase, {
    blockId,
    expectedVersion: parsed.data.version,
    objectiveId: parsed.data.objectiveId,
    done: parsed.data.done,
    actorUserId: user.id,
  });

  if (!result.ok) {
    if (result.reason === "not_found" || result.reason === "objective_not_found") {
      return NextResponse.json({ error: "Objectif introuvable." }, { status: 404 });
    }
    if (result.reason === "not_a_quest") {
      return NextResponse.json({ error: "Ce bloc n'est pas une quete." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Ce bloc a ete modifie entre-temps. Rechargez avant de reessayer." },
      { status: 409 }
    );
  }

  return NextResponse.json(result.block, { status: 200 });
}
