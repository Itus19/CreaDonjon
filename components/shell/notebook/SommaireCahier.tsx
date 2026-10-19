"use client";

import type { ReactNode } from "react";
import { GLYPHE_FICHE, GLYPHE_PAGE, GLYPHE_REGLE, type LigneSommaire } from "@/lib/ui/cahier";

export type EtatEnregistrement = "idle" | "saving" | "saved" | "error";

/** Une page partagée par quelqu'un d'autre (ligne de « Partagées à la table »). */
export interface AutreNote {
  entityId: string;
  titre: string;
  autrice: string | null;
}

export const LIBELLE_ENREGISTREMENT: Record<EtatEnregistrement, string> = {
  idle: "",
  saving: "Enregistrement…",
  saved: "Enregistré",
  error: "Échec de l'enregistrement",
};

const BOUTON_SECONDAIRE = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";
const BOUTON_RANGEE = "px-1 text-ink-muted hover:text-ink disabled:opacity-30";

function glyphe(genre: LigneSommaire["genre"]): string {
  return genre === "fiche" ? GLYPHE_FICHE : genre === "regle" ? GLYPHE_REGLE : GLYPHE_PAGE;
}

function teinte(ligne: LigneSommaire): string {
  if (ligne.cassee) return "text-danger";
  if (ligne.genre === "fiche") return "text-link-entity";
  if (ligne.genre === "regle") return "text-link-rule";
  return "";
}

function Titre({ children }: { children: ReactNode }) {
  return <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{children}</span>;
}

/** La marque « partagée » d'une page à soi que la table lit. */
export function MarquePartagee() {
  return <span className="shrink-0 rounded-full border border-accent/50 px-1.5 text-xs text-accent">partagée</span>;
}

/**
 * Sommaire arborescent (V3.1-42) : « Mon cahier » (ou « Mes notes ») avec ses
 * pages, ses fiches ◆ et ses règles §, puis « Partagées à la table » (les
 * pages des autres, chacune avec son autrice), puis les trois gestes du bas.
 * Les commandes de rangement n'existent que sur les lignes de SON cahier ;
 * une page d'une autre personne n'en a aucune.
 */
export default function SommaireCahier({
  titreSection,
  lignes,
  autres,
  lignesActives,
  autreActive,
  etat,
  protegees,
  epingleur,
  onOuvrirLigne,
  onOuvrirAutre,
  onDeplacer,
  onImbriquer,
  onDesimbriquer,
  onSupprimer,
  onNouvellePage,
  onPreparation,
}: {
  titreSection: string;
  lignes: LigneSommaire[];
  autres: AutreNote[];
  /** Lignes du cahier ouvertes : la page au centre, et la fiche ou règle épinglée dans le panneau. */
  lignesActives: ReadonlySet<string>;
  autreActive: string | null;
  etat: EtatEnregistrement;
  /** Lignes qu'on ne supprime pas ici : une page partagée (ou qui en contient une) resterait lisible de la table, sans plus aucun moyen de la retirer. */
  protegees: ReadonlySet<string>;
  epingleur: ReactNode;
  onOuvrirLigne: (ligne: LigneSommaire) => void;
  onOuvrirAutre: (entityId: string) => void;
  onDeplacer: (itemId: string, sens: -1 | 1) => void;
  onImbriquer: (itemId: string) => void;
  onDesimbriquer: (itemId: string) => void;
  onSupprimer: (itemId: string) => void;
  onNouvellePage: () => void;
  /** Absent pour une joueuse : « Préparation de séance » est un outil du MJ. */
  onPreparation?: () => void;
}) {
  return (
    <nav aria-label={titreSection} className="flex h-full min-h-0 flex-col gap-1 p-3">
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        <div className="flex items-center justify-between px-2 pb-1">
          <Titre>{titreSection}</Titre>
          <span role="status" className="text-xs text-ink-muted">
            {LIBELLE_ENREGISTREMENT[etat]}
          </span>
        </div>

        {lignes.length === 0 && <p className="px-2 text-xs italic text-ink-muted">Aucune page pour l&apos;instant.</p>}
        {lignes.map((ligne) => {
          const active = lignesActives.has(ligne.itemId);
          return (
            <div
              key={ligne.itemId}
              className={`group flex items-center gap-1 rounded-lg py-1 pr-1.5 text-xs ${active ? "bg-panel-raised text-ink" : "text-ink-soft hover:bg-panel-raised/60"}`}
              style={{ paddingLeft: 8 + ligne.profondeur * 14 }}
            >
              <button
                type="button"
                onClick={() => onOuvrirLigne(ligne)}
                aria-current={active ? "true" : undefined}
                title={ligne.cassee ? "Lien brisé" : undefined}
                className={`flex min-w-0 flex-1 items-center gap-1.5 text-left ${teinte(ligne)}`}
              >
                <span aria-hidden="true" className="shrink-0">
                  {glyphe(ligne.genre)}
                </span>
                <span className="truncate">{ligne.libelle}</span>
                {ligne.partagee && <MarquePartagee />}
              </button>
              <span className="hidden shrink-0 items-center gap-0.5 group-focus-within:flex group-hover:flex">
                <button type="button" onClick={() => onDeplacer(ligne.itemId, -1)} title="Monter" aria-label="Monter" className={BOUTON_RANGEE}>
                  ▲
                </button>
                <button type="button" onClick={() => onDeplacer(ligne.itemId, 1)} title="Descendre" aria-label="Descendre" className={BOUTON_RANGEE}>
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => onDesimbriquer(ligne.itemId)}
                  disabled={ligne.parentId === null}
                  title="Désimbriquer"
                  aria-label="Désimbriquer"
                  className={BOUTON_RANGEE}
                >
                  ←
                </button>
                <button type="button" onClick={() => onImbriquer(ligne.itemId)} title="Imbriquer sous le précédent" aria-label="Imbriquer sous le précédent" className={BOUTON_RANGEE}>
                  →
                </button>
                <button
                  type="button"
                  onClick={() => onSupprimer(ligne.itemId)}
                  disabled={protegees.has(ligne.itemId)}
                  title={protegees.has(ligne.itemId) ? "Une page partagée ne se supprime pas ici" : "Supprimer"}
                  aria-label="Supprimer"
                  className={`${BOUTON_RANGEE} hover:text-danger`}
                >
                  ×
                </button>
              </span>
            </div>
          );
        })}

        <div className="px-2 pb-1 pt-3">
          <Titre>Partagées à la table</Titre>
        </div>
        {autres.length === 0 && <p className="px-2 text-xs italic text-ink-muted">Rien n&apos;est partagé pour l&apos;instant.</p>}
        {autres.map((autre) => {
          const active = autre.entityId === autreActive;
          return (
            <button
              key={autre.entityId}
              type="button"
              onClick={() => onOuvrirAutre(autre.entityId)}
              aria-current={active ? "true" : undefined}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs ${active ? "bg-panel-raised text-ink" : "text-ink-soft hover:bg-panel-raised/60"}`}
            >
              <span aria-hidden="true" className="shrink-0">
                {GLYPHE_PAGE}
              </span>
              <span className="min-w-0 flex-1 truncate">{autre.titre.trim() || "(sans titre)"}</span>
              <span className="shrink-0 text-xs text-ink-muted">{autre.autrice ?? "Autrice inconnue"}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-1 flex shrink-0 flex-col gap-1.5 border-t border-edge pt-2">
        <button type="button" onClick={onNouvellePage} className={BOUTON_SECONDAIRE}>
          + Nouvelle page
        </button>
        {onPreparation && (
          <button type="button" onClick={onPreparation} className={BOUTON_SECONDAIRE}>
            + Préparation de séance
          </button>
        )}
        {epingleur}
      </div>
    </nav>
  );
}
