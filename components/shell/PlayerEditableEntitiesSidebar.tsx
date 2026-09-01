"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { EntitySummary } from "@/src/server/repos/entities";

/**
 * Sommaire de l'outil Édition (V2-M13, retour utilisateur : "la liste à
 * droite des fiches dont le joueur a l'accès d'édition afin de naviguer
 * entre elles... dans la même esthétique que le wiki") — liste plate
 * (jamais l'arborescence complète de `EntityTree`, hors de propos ici : ce
 * sommaire ne montre QUE les quelques fiches editables par ce joueur, pas
 * tout le monde), meme style de ligne que `EntityTree`/`PlayerWikiSidebar`.
 */
export default function PlayerEditableEntitiesSidebar({ worldSlug, entities }: { worldSlug: string; entities: EntitySummary[] }) {
  const pathname = usePathname();
  const base = `/m/${worldSlug}/joueur/fiche`;

  if (entities.length === 0) {
    return <p className="px-2 text-sm text-ink-muted">Aucune fiche éditable.</p>;
  }

  return (
    <nav aria-label="Fiches éditables" className="flex flex-col gap-0.5">
      {entities.map((entity) => {
        const href = `${base}/${entity.slug}`;
        const active = pathname === href;
        return (
          <Link
            key={entity.id}
            href={href}
            className={`truncate rounded px-2 py-1 text-sm transition-colors hover:bg-panel-raised ${
              active ? "bg-panel-raised text-accent" : "text-ink-soft"
            }`}
          >
            {entity.name || "(sans nom)"}
          </Link>
        );
      })}
    </nav>
  );
}
