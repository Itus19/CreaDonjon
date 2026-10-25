"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CustomTableBlockData } from "@/src/core/schemas/blocks/customTable";
import {
  ajouterColonne,
  ajouterLigne,
  modifierCellule,
  renommerColonne,
  retirerColonne,
  retirerLigne,
  valeurCellule,
} from "@/lib/ui/tableauBloc";

/**
 * V3.1-66 — le bloc Tableau : un vrai `<table>` éditable en cellules.
 * Tab passe de cellule en cellule (ce sont des champs natifs, dans l'ordre
 * de lecture). Les × de colonne et de ligne paraissent au survol et au
 * focus, toujours sur écran tactile ; « + » au bout des en-têtes, « + Ligne »
 * dessous.
 */

/** Visible en permanence sans survol possible (tactile), sinon au survol ou au focus de la rangée / de l'en-tête. */
const REVELE_AU_SURVOL =
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100";

/**
 * Nom de colonne : on tape dans un brouillon, le renommage (et son suffixe
 * éventuel si le nom est déjà pris) se fait en quittant le champ — sinon une
 * frappe en cours se verrait rebaptisée à chaque lettre.
 */
function NomColonne({ nom, onCommit }: { nom: string; onCommit: (nom: string) => void }) {
  const t = useTranslations("fiche.tableau");
  const [brouillon, setBrouillon] = useState(nom);
  return (
    <input
      value={brouillon}
      onChange={(e) => setBrouillon(e.target.value)}
      onBlur={() => {
        if (brouillon.trim() === "") setBrouillon(nom);
        else if (brouillon !== nom) onCommit(brouillon);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      aria-label={t("colonne")}
      className="w-full min-w-16 rounded-md bg-transparent px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted outline-none transition-colors focus:text-ink focus:ring-1 focus:ring-accent"
    />
  );
}

export default function CustomTableBlockEditor({
  data,
  onChange,
}: {
  data: CustomTableBlockData;
  onChange: (data: CustomTableBlockData) => void;
}) {
  const t = useTranslations("fiche.tableau");

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm" aria-label={t("tableau")}>
          <thead>
            <tr>
              {data.columns.map((column, index) => (
                <th
                  key={`${index}:${column}`}
                  scope="col"
                  className="group relative border-b border-edge bg-panel-sunken p-0 text-left first:rounded-tl-lg"
                >
                  <div className="flex items-center">
                    <NomColonne nom={column} onCommit={(nom) => onChange(renommerColonne(data, index, nom))} />
                    <button
                      type="button"
                      onClick={() => onChange(retirerColonne(data, index))}
                      aria-label={t("retirerColonne", { colonne: column })}
                      className={`mr-1 shrink-0 rounded-md px-1.5 text-sm font-normal text-ink-muted transition-colors hover:text-danger focus-visible:opacity-100 ${REVELE_AU_SURVOL}`}
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-9 border-b border-edge bg-panel-sunken p-0 text-center last:rounded-tr-lg">
                <button
                  type="button"
                  onClick={() => onChange(ajouterColonne(data))}
                  aria-label={t("ajouterColonne")}
                  title={t("ajouterColonne")}
                  className="rounded-md px-2 py-1 text-sm text-ink-muted transition-colors hover:text-accent"
                >
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="group">
                {data.columns.map((column) => (
                  <td key={column} className="border-b border-edge/40 p-0 group-hover:bg-ink/[0.03]">
                    <input
                      value={valeurCellule(row, column)}
                      onChange={(e) => onChange(modifierCellule(data, rowIndex, column, e.target.value))}
                      aria-label={t("cellule", { colonne: column, ligne: rowIndex + 1 })}
                      className="w-full rounded-md bg-transparent px-2 py-1.5 text-sm text-ink outline-none focus:ring-1 focus:ring-accent"
                    />
                  </td>
                ))}
                <td className="border-b border-edge/40 p-0 text-center">
                  <button
                    type="button"
                    onClick={() => onChange(retirerLigne(data, rowIndex))}
                    aria-label={t("retirerLigne", { ligne: rowIndex + 1 })}
                    className={`rounded-md px-1.5 text-sm text-ink-muted transition-colors hover:text-danger focus-visible:opacity-100 ${REVELE_AU_SURVOL}`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onChange(ajouterLigne(data))}
        disabled={data.columns.length === 0}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
      >
        {t("ajouterLigne")}
      </button>
    </div>
  );
}
