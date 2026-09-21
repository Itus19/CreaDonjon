import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { simulateTriggersSchema } from "@/lib/triggers/schemas";
import { runTriggers, type TriggerContext } from "@/src/core/rules/triggers";
import { serverRng } from "@/src/server/services/rng";

/**
 * Bac a sable de declencheurs (V3-A5) — « si tel evenement survient avec
 * telles donnees, voici ce qui se passerait ».
 *
 * MEME MOTEUR QUE LE JEU, jamais un chemin parallele : cette route appelle
 * `runTriggers`, exactement la fonction que `triggerRuntime.ts` invoque sur
 * un vrai jet de des. Un bac a sable qui simulerait a sa facon mentirait
 * precisement le jour ou l'on en aurait besoin — meme raison que le bac a
 * sable de formule (`/api/formula/evaluate`, V1-D4).
 *
 * AUCUNE LECTURE EN BASE, AUCUNE ECRITURE. Declencheurs, evenement et
 * acteurs viennent tous du corps de la requete : « sans toucher a une vraie
 * partie » est un critere du ticket, et c'est aussi ce qui rend l'outil
 * utile — on y essaie un etat qu'aucun personnage reel n'a.
 *
 * `serverRng` : un jet de sauvegarde declenche par une regle est lance par
 * le serveur, jamais par le client (CLAUDE.md regle 8), y compris ici.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = simulateTriggersSchema.safeParse(body);
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

  const ctx: TriggerContext = { actors: parsed.data.actors };
  const out = runTriggers({ event: parsed.data.event, triggers: parsed.data.triggers, ctx, rng: serverRng });

  // `failures` et `error` partent avec le reste : dans un bac a sable, une
  // regle qui echoue est l'information la plus utile de toutes.
  return NextResponse.json(out, { status: 200 });
}
