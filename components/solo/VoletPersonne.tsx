"use client";

import { AvatarPresent, libellePerception } from "@/components/solo/RondsPresents";
import { ZONE_LABELS } from "@/components/solo/ScenePanel";
import VoletLecture from "@/components/solo/VoletLecture";
import type { SceneView } from "@/lib/solo/types";

/**
 * ADR 0120 (V3.2-60, première étape) — Le volet d'une personne présente,
 * ouvert par un clic sur son visage dans le rail de jeu.
 *
 * Ce qu'il montre aujourd'hui, avec ce que le serveur sait déjà donner : le
 * grand anneau d'attitude PERÇUE (ADR 0111 : des crans, jamais la valeur
 * ressentie), le nom, l'attitude en mots, la distance, l'humeur de la scène,
 * puis sa page du wiki en entier, en vue joueur (`VoletLecture`).
 *
 * Ce qui viendra (même ticket et suivants) : le portrait dans l'anneau,
 * l'état physique, les barres continues avec zone floue (V3.2-61), la fiche,
 * l'inventaire et la psyché découverts (V3.2-62, 63). Ils attendent des
 * données que rien n'écrit encore (V3.2-15, V3.2-49).
 */
export default function VoletPersonne({
  worldSlug,
  personne,
  esquisse,
}: {
  worldSlug: string;
  personne?: SceneView["present"][number];
  esquisse?: SceneView["sketches"][number];
}) {
  const nom = personne?.name ?? esquisse?.name ?? "";
  const perception = personne?.perception ?? null;
  const zone = personne?.zone ?? esquisse?.zone ?? "near";
  const humeur = personne?.disposition ?? esquisse?.disposition ?? null;
  const attitude = libellePerception(perception);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <AvatarPresent nom={nom} perception={perception} esquisse={esquisse !== undefined} taille={116} />
        <span className="font-chrome text-lg font-semibold text-ink">{nom}</span>
        <span className="text-xs text-ink-muted">{[ZONE_LABELS[zone], humeur].filter(Boolean).join(" · ")}</span>
      </div>

      <section className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Envers toi</h3>
        <p className="text-sm text-ink">{attitude ?? "Rien de perceptible pour l'instant."}</p>
      </section>

      {esquisse && <p className="text-sm text-ink-soft">{esquisse.trait}. Pas encore de page au wiki : « garder cette fiche » dans Présents lui en donne une.</p>}

      {personne?.slug && (
        <section className="flex flex-col gap-2 border-t border-edge pt-3">
          <VoletLecture worldSlug={worldSlug} cible={{ type: "fiche", cle: personne.slug }} />
        </section>
      )}
    </div>
  );
}
