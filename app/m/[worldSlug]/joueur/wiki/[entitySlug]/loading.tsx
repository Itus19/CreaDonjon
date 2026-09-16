import WikiFicheSkeleton from "@/components/entities/public/WikiFicheSkeleton";

/**
 * V2.1-20 lot 1 — cette route a deux rendus possibles : le corps de fiche en
 * lecture (`PublicEntityBody`, le cas courant) ou l'éditeur complet, quand
 * `canEditEntity` autorise ce joueur sur CETTE fiche (V2-M7b). Le squelette
 * esquisse le premier dans les deux cas : il ne peut pas savoir lequel viendra
 * sans refaire la vérification de droits que la page est justement en train de
 * faire. Un décalage assumé — « quelque chose charge » reste plus juste qu'un
 * écran figé, et le cas de l'éditeur est le moins fréquent des deux.
 */
export default function Loading() {
  return <WikiFicheSkeleton />;
}
