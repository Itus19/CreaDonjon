"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import PublicEntityBody from "@/components/entities/public/PublicEntityBody";
import type { RuleEntryDetail } from "@/src/server/services/rules";
import type { EntitySummary } from "@/src/server/repos/entities";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import type { PublicBlock, PublicRelation } from "@/src/server/services/publicShare";
import type { CibleLecture } from "@/lib/ui/railJeu";
import type { NpcDisplayView } from "@/src/server/services/facetDiscoveries";

const RuleEntryView = dynamic(() => import("@/components/rules/RuleEntryView"), {
  ssr: false,
  loading: () => <p className="text-sm text-ink-muted">Chargement…</p>,
});

interface FicheJoueur {
  entity: EntitySummary;
  blocks: PublicBlock[];
  relations: PublicRelation[];
  portraitLayout: EntityPortraitLayout;
  /** V3.2-51 : ce que le personnage a découvert d'un PNJ. */
  npcView?: NpcDisplayView | null;
}

type Etat = { cle: string; statut: "pret"; fiche?: FicheJoueur; regle?: RuleEntryDetail } | { cle: string; statut: "erreur" };

/**
 * ADR 0120 (V3.2-57) — Une fiche du wiki ou une règle, lue en entier dans le
 * volet de consultation. Chargée au moment où on l'ouvre (une route par sorte,
 * celles que lit déjà le reste de l'app), jamais avec la page.
 *
 * Fiche : `/api/worlds/:monde/joueur/entities/:slug`, la vue joueur de la page
 * du wiki, rendue par le même corps de fiche. Règle : la route `/window` des
 * règles, rendue par `RuleEntryView`, comme le panneau de renvoi.
 */
export default function VoletLecture({ worldSlug, cible }: { worldSlug: string; cible: CibleLecture }) {
  const cleCible = `${cible.type}:${cible.cle}`;
  const [etat, setEtat] = useState<Etat | null>(null);

  useEffect(() => {
    let annule = false;
    const url =
      cible.type === "fiche"
        ? `/api/worlds/${encodeURIComponent(worldSlug)}/joueur/entities/${encodeURIComponent(cible.cle)}`
        : `/api/worlds/${encodeURIComponent(worldSlug)}/regles/${encodeURIComponent(cible.cle)}/window`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Réponse ${res.status}`);
        const donnees: unknown = await res.json();
        if (annule) return;
        setEtat(
          cible.type === "fiche"
            ? { cle: cleCible, statut: "pret", fiche: donnees as FicheJoueur }
            : { cle: cleCible, statut: "pret", regle: donnees as RuleEntryDetail }
        );
      })
      .catch((erreur: unknown) => {
        console.error("Lecture dans le volet impossible", erreur);
        if (!annule) setEtat({ cle: cleCible, statut: "erreur" });
      });
    return () => {
      annule = true;
    };
  }, [worldSlug, cible.type, cible.cle, cleCible]);

  // Un état d'une autre cible (on vient de changer de fiche) vaut « chargement ».
  if (!etat || etat.cle !== cleCible) return <p className="text-sm text-ink-muted">Chargement…</p>;
  if (etat.statut === "erreur") return <p className="text-sm text-ink-muted">Cette fiche ne peut pas s&apos;afficher.</p>;
  if (etat.fiche) {
    return (
      <div className="text-sm">
        <PublicEntityBody {...etat.fiche} hrefBase={`/m/${worldSlug}/joueur/wiki`} ruleHrefBase={`/m/${worldSlug}/joueur/regles`} />
      </div>
    );
  }
  if (etat.regle) return <RuleEntryView entry={etat.regle} worldSlug={worldSlug} />;
  return null;
}
