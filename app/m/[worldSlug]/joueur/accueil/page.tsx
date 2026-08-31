import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";

/**
 * Page d'accueil joueur (retour utilisateur, V2-M7b suite) : destination du
 * nom du monde dans la sidebar (`PlayerShell.tsx`) — jamais `/m/[worldSlug]`
 * (ecran MJ). Ferme "toutes les fiches au centre" par construction : une
 * route distincte de `joueur/wiki/[entitySlug]`/`joueur/regles/[cle]`,
 * jamais un etat client a reinitialiser. Contenu volontairement minimal
 * pour l'instant — le MJ y ajoutera des choses plus tard.
 */
export default async function JoueurAccueilPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);

  return (
    <div className="mx-auto max-w-[70ch]">
      <h1 className="entity-title">{world?.name ?? worldSlug}</h1>
      <p className="mt-2 text-sm text-ink-muted">Bienvenue.</p>
    </div>
  );
}
