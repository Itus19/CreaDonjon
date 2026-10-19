"use client";

import RichTextEditor from "@/components/entities/richtext/RichTextEditor";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import type { Segment } from "@/src/core/schemas/entities/segments";
import { enteteLectureSeule } from "@/lib/ui/cahier";
import LecturePage from "./LecturePage";
import SelecteurPartage, { type PortePartage } from "./SelecteurPartage";

/**
 * La page ouverte au centre, dans l'un de ses trois états :
 * - `page` : une page à soi, jamais partagée ;
 * - `partagee` : une page à soi devenue partagée (ou repassée en privée) ;
 * - `autre` : la page d'une autre personne, en lecture seule.
 * `fil` est le début du fil d'Ariane (« Mon cahier », le parent, ou « Partagées à la table »).
 */
export type PageOuverte =
  | { mode: "page"; cle: string; itemId: string; fil: string; titre: string; segments: Segment[]; peutSupprimer: boolean }
  | { mode: "partagee"; cle: string; itemId: string; fil: string; titre: string; segments: Segment[]; partagee: boolean }
  | { mode: "autre"; cle: string; fil: string; titre: string; segments: Segment[]; autrice: string | null };

const BOUTON_DANGER = "rounded-full border border-danger px-3 py-1 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50";

function indice(page: PageOuverte, estMj: boolean): string {
  if (page.mode === "autre") return "Partagée par son autrice : vous la lisez, elle seule l'écrit.";
  if (page.mode === "partagee" && page.partagee) return "La table la lit, l'écriture reste à vous. Elle apparaît chez chacun sous « Partagées à la table ».";
  return estMj ? "Privée : personne d'autre ne la lit." : "Privée : personne d'autre ne la lit, pas même le MJ.";
}

/**
 * Panneau de page (V3.1-42) : fil d'Ariane, titre, sélecteur de partage, puis
 * l'éditeur — ou, pour la page d'une autre personne, le texte seul, sans AUCUNE
 * commande d'écriture (ni champ de titre, ni sélecteur, ni suppression).
 *
 * Composant à part plutôt qu'une fonction appelée pendant le rendu :
 * `react-hooks/refs` refuse qu'une fermeture qui lit une référence soit créée
 * dans un appel de rendu ; ici les gestes arrivent en props.
 */
export default function PageCahier({
  page,
  estMj,
  worldSlug,
  worldId,
  otherEntities,
  occupe,
  erreur,
  onTitre,
  onContenu,
  onPartage,
  onSupprimer,
  onOuvrirFiche,
  onOuvrirRegle,
}: {
  page: PageOuverte;
  estMj: boolean;
  worldSlug: string;
  worldId: string;
  otherEntities: OtherEntityOption[];
  occupe: boolean;
  erreur: string | null;
  onTitre: (titre: string) => void;
  onContenu: (segments: Segment[]) => void;
  onPartage: (valeur: PortePartage) => void;
  onSupprimer: () => void;
  onOuvrirFiche: (slug: string) => void;
  onOuvrirRegle: (key: string) => void;
}) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-2">
      <div className="flex shrink-0 flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{page.fil} ›</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {page.mode === "autre" ? (
            <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-ink">{page.titre.trim() || "(sans titre)"}</h2>
          ) : (
            <input
              value={page.titre}
              onChange={(e) => onTitre(e.target.value)}
              maxLength={100}
              placeholder="Titre de la page"
              aria-label="Titre de la page"
              className="min-w-0 flex-1 bg-transparent font-display text-lg font-semibold text-ink outline-none placeholder:text-ink-muted"
            />
          )}
          {page.mode === "autre" ? (
            <span className="shrink-0 rounded-full border border-edge px-3 py-1 text-xs text-ink-muted">{enteteLectureSeule(page.autrice)}</span>
          ) : (
            <>
              <SelecteurPartage valeur={page.mode === "partagee" && page.partagee ? "table" : "privee"} occupe={occupe} onChange={onPartage} />
              {page.mode === "page" && page.peutSupprimer && (
                <button type="button" onClick={onSupprimer} className={BOUTON_DANGER}>
                  Supprimer
                </button>
              )}
            </>
          )}
        </div>
        <p className="text-xs text-ink-muted">{indice(page, estMj)}</p>
        {erreur && (
          <p role="alert" className="text-xs text-danger">
            {erreur}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-edge/60 pt-3">
        {page.mode === "autre" ? (
          <LecturePage segments={page.segments} otherEntities={otherEntities} onOuvrirFiche={onOuvrirFiche} onOuvrirRegle={onOuvrirRegle} />
        ) : (
          // `key` : l'éditeur ne lit ses segments qu'au montage, il doit repartir à neuf à chaque page.
          <RichTextEditor key={page.cle} segments={page.segments} onChange={onContenu} worldSlug={worldSlug} worldId={worldId} otherEntities={otherEntities} />
        )}
      </div>
    </div>
  );
}
