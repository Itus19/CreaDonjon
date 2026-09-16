import WikiFicheSkeleton from "@/components/entities/public/WikiFicheSkeleton";

/**
 * V2.1-20 lot 1 — la garde par mot de passe est posée par le layout ET par la
 * page ; ce squelette ne porte aucun contenu, il ne peut donc rien laisser
 * fuir avant vérification (V1-C4). Il n'apparaît d'ailleurs jamais sur un lien
 * protégé non déverrouillé : le layout rend alors `SharePasswordGate` à la
 * place de ses `children`, et cette frontière avec.
 */
export default function Loading() {
  return <WikiFicheSkeleton />;
}
