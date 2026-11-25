"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSoloContexte } from "@/components/solo/SoloContexte";
import { ZONE_LABELS } from "@/components/solo/ScenePanel";
import { RELATIONSHIP_AXIS_BAND_LABELS_FR, type BandTier } from "@/src/core/psyche/bands";
import { ecartDeCrans, type BandePositive, type PerceptionPercue } from "@/src/core/psyche/perception";
import type { SceneView } from "@/lib/solo/types";

/**
 * V3.2-14 — Les présents dans la bande du Monde replié (option D2 des
 * esquisses du 25 novembre).
 *
 * Un rond par personne présente : ses initiales, et un anneau qui dit comment
 * elle SEMBLE percevoir le personnage (ADR 0111 : la perception, jamais la
 * vérité — le serveur n'envoie que des bandes). L'anneau est à la fois une
 * couleur et une jauge : sa longueur porte le cran, ce qui le rend lisible
 * sans distinguer le rouge du vert. L'attirance, quand le PNJ l'a montrée, a
 * son propre cercle fin à l'extérieur, pour ne jamais cacher l'amitié.
 *
 * Couleurs en OKLCH direct, même précédent que `relationshipColor` : une
 * échelle sémantique dérivée d'une bande, pas une des teintes fixes des
 * jetons. Clarté constante, seule la teinte change.
 */

const COULEUR: Record<BandTier, string> = {
  extreme_neg: "oklch(0.66 0.19 25)",
  strong_neg: "oklch(0.70 0.17 38)",
  slight_neg: "oklch(0.76 0.14 65)",
  neutral: "oklch(0.72 0.012 152)",
  slight_pos: "oklch(0.80 0.13 115)",
  strong_pos: "oklch(0.76 0.16 150)",
  extreme_pos: "oklch(0.78 0.13 180)",
};
const ROSE = "oklch(0.76 0.15 350)";

/** Longueur de l'anneau d'amitié : un petit bout pour « haineux », la moitié pour « indifférent », le tour complet pour « dévoué ». */
const LONGUEUR: Record<BandTier, number> = {
  extreme_neg: 0.1,
  strong_neg: 1 / 6,
  slight_neg: 2 / 6,
  neutral: 3 / 6,
  slight_pos: 4 / 6,
  strong_pos: 5 / 6,
  extreme_pos: 1,
};
const LONGUEUR_ROSE: Record<BandePositive, number> = { slight_pos: 1 / 3, strong_pos: 2 / 3, extreme_pos: 1 };

const ORDRE_ZONES = ["engaged", "near", "far"] as const;
type Zone = (typeof ORDRE_ZONES)[number];

interface Rond {
  id: string;
  nom: string;
  zone: Zone;
  perception: PerceptionPercue | null;
  esquisse: boolean;
}

function initiales(nom: string): string {
  const mots = nom
    .replace(/[,.'’«»"]/g, " ")
    .split(/\s+/)
    .filter((m) => m.length > 0 && m[0] === m[0].toUpperCase() && /\p{L}/u.test(m[0]));
  const lettres = (mots.length > 0 ? mots : [nom]).slice(0, 2).map((m) => m[0]);
  return lettres.join("").toUpperCase();
}

/** Deux noms se comparent sans casse, accents ni ponctuation : le fil écrit « Mabelle, du Fanal », la fiche « Mabelle du Fanal ». */
function cle(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function Arc({ r, part, couleur, epaisseur, pointilles }: { r: number; part: number; couleur: string; epaisseur: number; pointilles?: boolean }) {
  const tour = 2 * Math.PI * r;
  return (
    <circle
      cx="22"
      cy="22"
      r={r}
      fill="none"
      stroke={couleur}
      strokeWidth={epaisseur}
      strokeLinecap={pointilles ? "butt" : "round"}
      strokeDasharray={pointilles ? "2.6 2.2" : `${(tour * part).toFixed(2)} ${tour.toFixed(2)}`}
      transform="rotate(-90 22 22)"
    />
  );
}

export function AvatarPresent({ nom, perception, esquisse, taille = 32 }: { nom: string; perception: PerceptionPercue | null; esquisse: boolean; taille?: number }) {
  return (
    <svg viewBox="0 0 44 44" width={taille} height={taille} aria-hidden="true" className="block shrink-0">
      <circle cx="22" cy="22" r="14" className="fill-panel-raised" />
      <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="600" className="fill-ink">
        {initiales(nom)}
      </text>
      {/* La piste : pleine et discrète pour une fiche, en pointillés pour une esquisse sans fiche. */}
      <circle cx="22" cy="22" r="17" fill="none" className="stroke-edge" strokeWidth={2.6} strokeDasharray={esquisse ? "2.6 2.2" : undefined} />
      {perception && <Arc r={17} part={LONGUEUR[perception.friendship]} couleur={COULEUR[perception.friendship]} epaisseur={2.8} />}
      {perception?.attraction && (
        <>
          <circle cx="22" cy="22" r="20.6" fill="none" stroke={ROSE} strokeOpacity={0.25} strokeWidth={1.4} />
          <Arc r={20.6} part={LONGUEUR_ROSE[perception.attraction]} couleur={ROSE} epaisseur={1.6} />
        </>
      )}
    </svg>
  );
}

/** « cordial · intrigué » : les crans en mots, jamais en nombre (specs/psyche-pnj.md §1.5). */
export function libellePerception(perception: PerceptionPercue | null): string | null {
  if (!perception) return null;
  const amitie = RELATIONSHIP_AXIS_BAND_LABELS_FR.friendship_hostility[perception.friendship];
  const attirance = perception.attraction ? RELATIONSHIP_AXIS_BAND_LABELS_FR.attraction_repulsion[perception.attraction] : null;
  return attirance ? `${amitie} · ${attirance}` : amitie;
}

export default function RondsPresents({ present, sketches }: { present: SceneView["present"]; sketches: SceneView["sketches"] }) {
  const t = useTranslations("solo.bandeMonde");
  const { deplierMonde, interlocuteur } = useSoloContexte();

  const ronds: Rond[] = [
    ...present.map((p) => ({ id: p.entityId, nom: p.name, zone: p.zone, perception: p.perception ?? null, esquisse: false })),
    ...sketches.map((s) => ({ id: s.id, nom: s.name, zone: s.zone, perception: null, esquisse: true })),
  ];

  // Un changement de deux crans ou plus pulse une fois (specs/psyche-pnj.md §5). La perception
  // précédente est gardée en état et comparée pendant le rendu : le motif React « ajuster l'état
  // quand une prop change », sans effet.
  const [precedent, setPrecedent] = useState(present);
  const [pulses, setPulses] = useState<ReadonlySet<string>>(new Set());
  if (precedent !== present) {
    const avant = new Map(precedent.map((p) => [p.entityId, p.perception?.friendship]));
    const changes = new Set<string>();
    for (const p of present) {
      const a = avant.get(p.entityId);
      const b = p.perception?.friendship;
      if (a && b && ecartDeCrans(a, b) >= 2) changes.add(p.entityId);
    }
    setPrecedent(present);
    setPulses(changes);
  }

  if (ronds.length === 0) return null;

  return (
    <ul aria-label={t("presentsAria")} className="flex flex-col items-center gap-2 border-t border-edge pt-3">
      {ORDRE_ZONES.flatMap((zone, i) => {
        const groupe = ronds.filter((r) => r.zone === zone);
        if (groupe.length === 0) return [];
        const separateur = i > 0 && ronds.some((r) => ORDRE_ZONES.indexOf(r.zone) < i);
        return groupe.map((r, j) => {
          const perception = libellePerception(r.perception);
          const libelle = [r.nom, perception, ZONE_LABELS[r.zone], r.esquisse ? t("sansFiche") : null].filter(Boolean).join(" · ");
          const parle = interlocuteur !== null && cle(interlocuteur) === cle(r.nom);
          return (
            <li key={r.id} className={`flex flex-col items-center ${separateur && j === 0 ? "border-t border-edge pt-2" : ""}`}>
              <button
                type="button"
                onClick={() => deplierMonde("presents")}
                aria-label={libelle}
                title={libelle}
                className={`rounded-full transition-opacity hover:opacity-100 motion-reduce:transition-none ${r.zone === "far" ? "opacity-60" : ""} ${
                  parle ? "bg-accent/15 ring-2 ring-accent/30" : ""
                } ${pulses.has(r.id) ? "motion-safe:animate-[pulse_1s_ease-in-out_1]" : ""}`}
              >
                <AvatarPresent nom={r.nom} perception={r.perception} esquisse={r.esquisse} />
              </button>
            </li>
          );
        });
      })}
    </ul>
  );
}
