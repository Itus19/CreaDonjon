import Link from "next/link";
import type { SceneView } from "@/lib/solo/types";

/**
 * V3-D2 — L'en-tête d'état du bandeau solo : où l'on est, à gauche ;
 * quand, à droite. Remplace le contenu provisoire de V3-D1 (nom du
 * personnage), qui se réinstalle dans la fiche jouable (V3-D5).
 *
 * Pas de "use client" : deux liens et du texte statique, aucune
 * interactivité. La coquille joueur (`joueur/layout.tsx`) ne branche
 * jamais le paradigme fenêtres flottantes — un `<Link>` normal suffit,
 * jamais `useOpenEntityLink`.
 *
 * **Tout ici vient du moteur** (scène, calendrier) — jamais un champ
 * libre, jamais une valeur devinée par un modèle (règle absolue 8).
 */
export default function EnTeteEtat({
  worldSlug,
  scene,
  dateLabel,
}: {
  worldSlug: string;
  scene: SceneView | null;
  /** Déjà formatée côté serveur (`sceneDateLabel`) — `null` si le MJ n'a jamais réglé de date "aujourd'hui" à la précision du jour. */
  dateLabel: string | null;
}) {
  if (scene === null) {
    return <p className="text-sm text-ink-muted">Aucune scène posée — pose-la depuis le panneau ci-dessous.</p>;
  }

  const heure = `${String(scene.time.hour).padStart(2, "0")}:${String(scene.time.minute).padStart(2, "0")}`;

  return (
    <>
      {/*
       * Trois niveaux prévus par le ticket (ville, lieu, pièce) ; seuls les
       * deux premiers ont une source de données aujourd'hui. La pièce
       * n'est trackée nulle part dans l'état de scène — omise plutôt
       * qu'inventée, même principe que la météo à droite.
       */}
      <nav className="flex flex-wrap items-baseline gap-x-2" aria-label="Où se passe la scène">
        {scene.nearestCity && (
          <>
            <Link href={`/m/${worldSlug}/joueur/wiki/${scene.nearestCity.slug}`} className="text-sm font-medium text-link-entity hover:underline">
              {scene.nearestCity.name}
            </Link>
            <span className="text-ink-muted">·</span>
          </>
        )}
        {scene.locationSlug ? (
          <Link href={`/m/${worldSlug}/joueur/wiki/${scene.locationSlug}`} className="text-sm font-medium text-link-entity hover:underline">
            {scene.locationName}
          </Link>
        ) : (
          <span className="text-sm font-medium text-ink">{scene.locationName}</span>
        )}
      </nav>

      {/* Météo et température : V3-C6, pas encore fait — omises plutôt que d'afficher une valeur inventée. */}
      <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        {dateLabel && <span className="text-sm text-ink-soft">{dateLabel}</span>}
        <span className="text-sm text-ink">{heure}</span>
      </div>
    </>
  );
}
