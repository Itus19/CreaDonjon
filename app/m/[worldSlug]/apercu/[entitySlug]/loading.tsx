import WikiFicheSkeleton from "@/components/entities/public/WikiFicheSkeleton";

/** V2.1-20 lot 1 — même squelette que `/partage` et que l'onglet Wiki joueur : une seule peau de wiki depuis V2.1-12, donc un seul état de chargement. */
export default function Loading() {
  return <WikiFicheSkeleton />;
}
