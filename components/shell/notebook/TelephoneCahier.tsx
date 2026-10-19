"use client";

import type { ReactNode } from "react";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import Tabs, { TabPanel } from "@/components/shared/Tabs";
import { GLYPHE_FICHE, GLYPHE_PAGE, GLYPHE_REGLE, epinglees, type LigneSommaire } from "@/lib/ui/cahier";
import { LIBELLE_ENREGISTREMENT, MarquePartagee, type AutreNote, type EtatEnregistrement } from "./SommaireCahier";

export type OngletTelephone = "miennes" | "partagees";

const BOUTON_SECONDAIRE = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";
const PANNEAU = "overflow-hidden rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)]";
const RANGEE = "flex w-full items-center gap-2.5 border-b border-edge/60 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-panel-raised/60";

function glyphe(genre: LigneSommaire["genre"]): string {
  return genre === "fiche" ? GLYPHE_FICHE : genre === "regle" ? GLYPHE_REGLE : GLYPHE_PAGE;
}

function teinte(ligne: LigneSommaire): string {
  if (ligne.cassee) return "text-danger";
  if (ligne.genre === "fiche") return "text-link-entity";
  if (ligne.genre === "regle") return "text-link-rule";
  return "text-ink";
}

function Section({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-1 text-xs font-bold uppercase tracking-widest text-ink-muted">{children}</h2>;
}

function RangeesCahier({ lignes, onOuvrirLigne }: { lignes: LigneSommaire[]; onOuvrirLigne: (ligne: LigneSommaire) => void }) {
  if (lignes.length === 0) return <p className="px-1 text-xs italic text-ink-muted">Aucune page pour l&apos;instant.</p>;
  return (
    <div className={PANNEAU}>
      {lignes.map((ligne) => (
        <button key={ligne.itemId} type="button" onClick={() => onOuvrirLigne(ligne)} className={`${RANGEE} ${teinte(ligne)}`} style={{ paddingLeft: 12 + ligne.profondeur * 18 }}>
          <span aria-hidden="true">{glyphe(ligne.genre)}</span>
          <span className="min-w-0 flex-1 truncate">{ligne.libelle}</span>
          {ligne.partagee && <MarquePartagee />}
          <span aria-hidden="true" className="text-ink-muted">
            ›
          </span>
        </button>
      ))}
    </div>
  );
}

function RangeesAutres({ autres, onOuvrirAutre }: { autres: AutreNote[]; onOuvrirAutre: (entityId: string) => void }) {
  if (autres.length === 0) return <p className="px-1 text-xs italic text-ink-muted">Rien n&apos;est partagé pour l&apos;instant.</p>;
  return (
    <div className={PANNEAU}>
      {autres.map((autre) => (
        <button key={autre.entityId} type="button" onClick={() => onOuvrirAutre(autre.entityId)} className={`${RANGEE} text-ink`}>
          <span aria-hidden="true">{GLYPHE_PAGE}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{autre.titre.trim() || "(sans titre)"}</span>
            <span className="block text-xs text-ink-muted">partagée par {autre.autrice ?? "une autrice inconnue"}</span>
          </span>
          <span aria-hidden="true" className="text-ink-muted">
            ›
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Le cahier au téléphone (V3.1-42), sous la largeur de la fenêtre des outils.
 * - MJ : les épinglées en puces, « Mon cahier » puis « Partagées à la table »
 *   en liste ;
 * - joueuse : la pilule « Les miennes / Partagées à la table » (`Tabs`) ;
 * - la page s'ouvre en plein écran (retour ‹), la fiche citée en feuille du bas.
 * Les données et les gestes viennent de `NotebookWorkspace` : rien n'est chargé ici.
 */
export default function TelephoneCahier({
  estMj,
  titreSection,
  lignes,
  autres,
  etat,
  enPage,
  titrePage,
  page,
  fiche,
  titreFiche,
  onglet,
  epingleur,
  onOnglet,
  onOuvrirLigne,
  onOuvrirAutre,
  onRetour,
  onFermerFiche,
  onNouvellePage,
  onPreparation,
}: {
  estMj: boolean;
  titreSection: string;
  lignes: LigneSommaire[];
  autres: AutreNote[];
  etat: EtatEnregistrement;
  enPage: boolean;
  titrePage: string;
  /** La page ouverte, déjà montée par le parent (éditeur ou lecture seule). */
  page: ReactNode;
  /** La fiche citée, déjà montée par le parent, ou `null`. */
  fiche: ReactNode | null;
  titreFiche: string;
  onglet: OngletTelephone;
  epingleur: ReactNode;
  onOnglet: (onglet: OngletTelephone) => void;
  onOuvrirLigne: (ligne: LigneSommaire) => void;
  onOuvrirAutre: (entityId: string) => void;
  onRetour: () => void;
  onFermerFiche: () => void;
  onNouvellePage: () => void;
  onPreparation?: () => void;
}) {
  const pins = epinglees(lignes);
  const cahier = estMj ? lignes.filter((l) => l.genre === "page" || l.genre === "page_partagee") : lignes;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        {enPage && (
          <button
            type="button"
            onClick={onRetour}
            aria-label="Retour au sommaire"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-edge text-ink transition-colors hover:bg-panel-raised"
          >
            ‹
          </button>
        )}
        <span className="min-w-0 flex-1 truncate font-display text-base font-semibold text-ink">{enPage ? titrePage.trim() || "(sans titre)" : "Bloc-notes"}</span>
        <span role="status" className="shrink-0 text-xs text-ink-muted">
          {LIBELLE_ENREGISTREMENT[etat]}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {enPage ? (
          <div className={`${PANNEAU} h-full p-3`}>{page}</div>
        ) : estMj ? (
          <div className="flex flex-col gap-2 pb-2">
            {pins.length > 0 && (
              <>
                <Section>Épinglées</Section>
                <div className="flex flex-wrap gap-1.5">
                  {pins.map((ligne) => (
                    <button
                      key={ligne.itemId}
                      type="button"
                      onClick={() => onOuvrirLigne(ligne)}
                      className={`rounded-full border border-edge px-3 py-1 text-xs ${teinte(ligne)}`}
                    >
                      {glyphe(ligne.genre)} {ligne.libelle}
                    </button>
                  ))}
                </div>
              </>
            )}
            <Section>{titreSection}</Section>
            <RangeesCahier lignes={cahier} onOuvrirLigne={onOuvrirLigne} />
            <Section>Partagées à la table</Section>
            <RangeesAutres autres={autres} onOuvrirAutre={onOuvrirAutre} />
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={onNouvellePage} className={BOUTON_SECONDAIRE}>
                + Page
              </button>
              {onPreparation && (
                <button type="button" onClick={onPreparation} className={BOUTON_SECONDAIRE}>
                  + Préparation
                </button>
              )}
            </div>
            {epingleur}
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-2">
            <Tabs
              value={onglet}
              onChange={onOnglet}
              aria-label="Notes"
              idPrefix="cahier-tel"
              items={[
                { value: "miennes", label: "Les miennes" },
                { value: "partagees", label: "Partagées à la table" },
              ]}
            />
            <TabPanel idPrefix="cahier-tel" value={onglet} className="flex flex-col gap-2">
              {onglet === "miennes" ? (
                <>
                  <p className="text-xs text-ink-muted">Votre cahier. Une page partagée reste ici, marquée « partagée ».</p>
                  <RangeesCahier lignes={cahier} onOuvrirLigne={onOuvrirLigne} />
                  <div className="flex flex-col gap-2 pt-1">
                    <button type="button" onClick={onNouvellePage} className={BOUTON_SECONDAIRE}>
                      + Page
                    </button>
                    {epingleur}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-ink-muted">Ce que la table a partagé, MJ compris. Lecture seule.</p>
                  <RangeesAutres autres={autres} onOuvrirAutre={onOuvrirAutre} />
                </>
              )}
            </TabPanel>
          </div>
        )}
      </div>

      {fiche && (
        <FeuilleDuBas titre={titreFiche} titreVisible onFermer={onFermerFiche}>
          <div className="min-h-[40dvh]">{fiche}</div>
        </FeuilleDuBas>
      )}
    </div>
  );
}
