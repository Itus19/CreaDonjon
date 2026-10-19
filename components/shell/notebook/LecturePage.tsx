"use client";

import { createElement, type ReactNode } from "react";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import type { NarrativeContent, Segment, SegmentContentNode } from "@/src/core/schemas/entities/segments";

const BALISE: Record<Segment["blockType"], string> = { paragraph: "p", h1: "h1", h2: "h2", h3: "h3", h4: "h4", divider: "hr" };

/** Applique les marques de mise en forme d'un noeud texte, de l'intérieur vers l'extérieur. Le `spoiler` est de la mise en forme, pas de la sécurité (règle 6). */
function marquer(noeud: Extract<SegmentContentNode, { t: "text" }>): ReactNode {
  let rendu: ReactNode = noeud.v;
  for (const marque of noeud.marks ?? []) {
    if (marque === "bold") rendu = <strong>{rendu}</strong>;
    else if (marque === "italic") rendu = <em>{rendu}</em>;
    else if (marque === "underline") rendu = <u>{rendu}</u>;
    else if (marque === "strike") rendu = <s>{rendu}</s>;
    else rendu = <span data-spoiler="true">{rendu}</span>;
  }
  return rendu;
}

/**
 * Une page d'une autre personne, en LECTURE SEULE (V3.1-42) : aucun éditeur,
 * aucun champ, aucune commande d'écriture. Le texte a déjà été filtré par le
 * serveur ; ici on ne fait que l'afficher. Un lien de fiche ne s'ouvre que si
 * la fiche est connue de la lectrice (le serveur retire l'identifiant des
 * autres) ; un lien de règle ouvre la règle dans le panneau compagnon.
 */
export default function LecturePage({
  segments,
  otherEntities,
  onOuvrirFiche,
  onOuvrirRegle,
}: {
  segments: NarrativeContent;
  otherEntities: OtherEntityOption[];
  onOuvrirFiche: (slug: string) => void;
  onOuvrirRegle: (key: string) => void;
}) {
  function noeud(n: SegmentContentNode, index: number): ReactNode {
    if (n.t === "text") return <span key={index}>{marquer(n)}</span>;
    if (n.kind === "entity" && n.id) {
      const fiche = otherEntities.find((e) => e.id === n.id);
      if (fiche) {
        return (
          <button key={index} type="button" onClick={() => onOuvrirFiche(fiche.slug)} className="rich-ref-mention">
            {n.label}
          </button>
        );
      }
    }
    if (n.kind === "rule" && n.key) {
      const cle = n.key;
      return (
        <button key={index} type="button" onClick={() => onOuvrirRegle(cle)} className="rich-ref-mention">
          {n.label}
        </button>
      );
    }
    return <span key={index}>{n.label}</span>;
  }

  return (
    // Révéler un spoiler est une bascule d'affichage locale, comme dans l'éditeur.
    <div
      className="rich-text-content"
      onClick={(e) => {
        const cible = (e.target as HTMLElement).closest("[data-spoiler]");
        if (cible) cible.setAttribute("data-revealed", String(cible.getAttribute("data-revealed") !== "true"));
      }}
    >
      {segments.map((segment) =>
        segment.blockType === "divider"
          ? createElement(BALISE.divider, { key: segment.id, "data-align": segment.align })
          : createElement(BALISE[segment.blockType], { key: segment.id, "data-align": segment.align }, segment.content.map(noeud)),
      )}
    </div>
  );
}
