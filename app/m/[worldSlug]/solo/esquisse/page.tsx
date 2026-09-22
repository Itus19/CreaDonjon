import EsquisseSolo from "@/components/solo/esquisse/EsquisseSolo";

/**
 * V3-D — L'esquisse de l'écran solo, à regarder puis à jeter.
 *
 * Route délibérément posée sous `/m/[worldSlug]/solo`, l'adresse que V3-D1
 * prévoit pour le vrai écran (et non sous `joueur/`, où vit l'écran
 * minimal de V3-B1) : on regarde la disposition là où elle vivra.
 *
 * Aucune donnée, aucune requête, aucun compte nécessaire au-delà de la
 * session : tout vient de `fixtures.ts`. C'est ce qui permet de l'ouvrir
 * sur un téléphone en trois secondes, ce qui est la moitié de ce qu'on
 * cherche à juger.
 */
export default function EsquisseSoloPage() {
  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col p-4">
      <EsquisseSolo />
    </div>
  );
}
