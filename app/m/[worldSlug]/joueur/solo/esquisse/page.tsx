import EsquisseSolo from "@/components/solo/esquisse/EsquisseSolo";

/**
 * V3-D — L'esquisse de l'écran solo, à regarder puis à jeter.
 *
 * Posée sous `joueur/`, **et c'est une décision** : le backlog place D1 sur
 * `/m/[worldSlug]/solo`, hors coquille, mais l'auteur veut la barre
 * latérale joueur et ses outils. L'écran solo est donc une destination de
 * `PlayerShell` comme les autres, exactement comme l'écran minimal de
 * V3-B1 — et l'adresse de D1 est à corriger.
 *
 * Aucune donnée, aucune requête : tout vient de `fixtures.ts`. C'est ce
 * qui permet de l'ouvrir sur un téléphone en trois secondes, ce qui est la
 * moitié de ce qu'on cherche à juger.
 */
export default function EsquisseSoloPage() {
  // `h-full` sans largeur maximale : la coquille joueur pose déjà son
  // rembourrage et sa hauteur, et les trois colonnes doivent prendre tout
  // ce qui reste.
  return (
    <div className="flex h-full flex-col">
      <EsquisseSolo />
    </div>
  );
}
