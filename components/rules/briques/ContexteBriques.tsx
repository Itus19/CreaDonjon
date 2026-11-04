"use client";

import { createContext, useContext } from "react";
import { useTranslations } from "next-intl";
import Dropdown, { type DropdownOption } from "@/components/shared/Dropdown";
import type { BrouillonEffet, EntreeAjout } from "@/lib/ui/briquesRegle";

/**
 * V3.1-132 — ce que partagent toutes les cartes de l'éditeur : la sélection
 * du texte (pour « Citer »), la brique survolée (surlignage dans le texte),
 * la liste des états et des ressources, la fabrique de nouvelles briques.
 */
export interface ContexteBriquesValeur {
  /** Le passage sélectionné dans le texte de la règle, prêt à être cité. */
  selection: string | null;
  survol: string | null;
  setSurvol: (uid: string | null) => void;
  etats: DropdownOption[];
  ressources: DropdownOption[];
  numeros: Map<string, number>;
  creerEffet: (entree: EntreeAjout) => BrouillonEffet;
}

const Contexte = createContext<ContexteBriquesValeur | null>(null);
export const FournisseurBriques = Contexte.Provider;

export function useContexteBriques(): ContexteBriquesValeur {
  const c = useContext(Contexte);
  if (!c) throw new Error("useContexteBriques hors de l'éditeur de briques.");
  return c;
}

/** Une carte de brique : surlignée quand son passage (ou elle) est survolé. */
export function CarteBrique({
  uid,
  titre,
  numero,
  pointille,
  actions,
  children,
}: {
  uid: string;
  titre: string;
  numero?: number;
  pointille?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { survol, setSurvol } = useContexteBriques();
  return (
    <div
      onMouseEnter={() => setSurvol(uid)}
      onMouseLeave={() => setSurvol(null)}
      onFocus={() => setSurvol(uid)}
      onBlur={() => setSurvol(null)}
      className={`flex flex-col gap-3 rounded-lg border bg-panel-sunken p-3 ${pointille ? "border-dashed" : ""} ${survol === uid ? "border-accent" : "border-edge"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {numero !== undefined && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-edge font-mech text-xs text-ink-soft">{numero}</span>
        )}
        <span className="text-sm font-medium text-ink">{titre}</span>
        <span className="flex-1" />
        {actions}
      </div>
      {children}
    </div>
  );
}

/** Un champ à liste déroulante, avec son libellé visible. */
export function ChampListe({
  libelle,
  valeur,
  options,
  onChange,
}: {
  libelle: string;
  valeur: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">
      <span>{libelle}</span>
      <Dropdown value={valeur} options={options} onChange={onChange} size="md" aria-label={libelle} />
    </div>
  );
}

/** Un champ de texte ou de nombre court, avec son libellé visible. */
export function ChampTexte({ libelle, valeur, onChange, mecanique }: { libelle: string; valeur: string; onChange: (v: string) => void; mecanique?: boolean }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">
      {libelle}
      <input
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none ${mecanique ? "font-mech" : ""}`}
      />
    </label>
  );
}

/** « Citer » / « Retirer la citation » : le passage du texte dont vient la brique. Facultatif. */
export function Citation({ passage, onChange }: { passage: string | null; onChange: (p: string | null) => void }) {
  const t = useTranslations("regles.briques");
  const { selection } = useContexteBriques();
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
      {passage ? (
        <>
          <span className="min-w-0 flex-1 truncate italic" title={passage}>
            « {passage} »
          </span>
          <button type="button" onClick={() => onChange(null)} className="text-danger hover:underline">
            {t("retirerCitation")}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={!selection}
          onClick={() => selection && onChange(selection)}
          title={selection ? undefined : t("citerAide")}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {t("citer")}
        </button>
      )}
    </div>
  );
}

export function BoutonPetit({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border border-edge px-3 py-1 text-xs transition-colors hover:bg-panel-raised disabled:opacity-50 ${danger ? "text-danger" : "text-ink"}`}
    >
      {children}
    </button>
  );
}
