import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { isWorldAdmin } from "@/src/server/services/permissions";
import GmJournalPanel from "@/components/shell/GmJournalPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/**
 * Journal d'historique (V2-M7 suite, retour utilisateur : "separe les deux
 * outils Journal et Campagne") — extrait de l'ancienne page Campagnes, qui
 * melangeait permissions et historique de modifications dans le meme outil.
 * Reserve au MJ reel de ce monde, verifie ici ET dans l'API du journal
 * (isWorldAdmin), jamais seulement en cachant le composant.
 */
export default async function MjJournalHistoriquePage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const gm = user ? await isWorldAdmin(supabase, { worldId: world.id, userId: user.id }) : false;

  return (
    <div className="flex flex-col gap-4">
      <RegisterPrimaryWindow
        windowRef={{ kind: "mj", key: "journal-historique" }}
        name="Journal d'historique"
        badge=""
        homeHref={`/m/${worldSlug}/mj/journal-historique`}
      />
      {gm ? <GmJournalPanel worldSlug={worldSlug} /> : <p className="text-sm text-ink-muted">Réservé au MJ de ce monde.</p>}
    </div>
  );
}
