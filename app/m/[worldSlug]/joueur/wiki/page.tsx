import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listEntities } from "@/src/server/services/entities";

/**
 * Wiki en lecture seule (V2-M7b, coquille joueur) : meme liste que la
 * sidebar MJ (`listEntities`, deja filtree des fiches de notes privees
 * d'autrui), simple liste plate plutot que l'arbre complet — la coquille
 * joueur n'a pas les categories/reordonnancement du MJ.
 */
export default async function JoueurWikiPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "notes" a son propre onglet (Notes) — jamais mélangée à la liste du
  // wiki, meme pour son propre createur (deja exclue des AUTRES comptes par
  // `listEntities`, ici en plus exclue de la sienne aussi).
  const entities = (await listEntities(supabase, world.id, user?.id ?? null)).filter((e) => e.entity_kind !== "notes");

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-ink">Wiki</h2>
      {entities.length === 0 && <p className="text-sm text-ink-muted">Rien à consulter pour l&apos;instant.</p>}
      <ul className="flex flex-col gap-1">
        {entities.map((e) => (
          <li key={e.id}>
            <Link
              href={`/m/${worldSlug}/joueur/wiki/${e.slug}`}
              className="block rounded-md border border-edge bg-panel px-3 py-2 text-sm text-ink transition-colors hover:bg-panel-raised"
            >
              {e.name}
              <span className="ml-2 text-xs text-ink-muted">{e.entity_kind}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
