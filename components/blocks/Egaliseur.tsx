"use client";

import { useTranslations } from "next-intl";
import type { ColonneEgaliseur, GesteColonne, GroupeEgaliseur } from "@/lib/ui/egaliseur";

/**
 * V3.1-114 — l'égaliseur de la fiche jouable (planche « Emplacements et
 * ressources de classe — décidé ») : une seule ligne pour tout ce qui se
 * dépense, en groupes titrés côte à côte. Aucune requête ici : la fiche
 * décide quoi faire d'un geste (`onGeste`). Delta +1 = dépenser, -1 = rendre.
 *
 * Couleurs, jetons seulement : `link-entity` (violet) pour les emplacements et
 * la réserve de pacte, `accent` (ambre) pour les ressources. Le pacte se
 * distingue par son libellé « Pacte niv. n » et par sa place, à la suite des
 * niveaux, après un séparateur.
 */

// eslint-disable-next-line no-restricted-syntax -- glyphe (▼ ▲), pas libellé : même exception que components/shared/Stepper.tsx.
const TAILLE_GLYPHE = "text-[8px]";

const PLEIN: Record<ColonneEgaliseur["genre"], string> = {
  emplacement: "bg-link-entity border-link-entity",
  pacte: "bg-link-entity border-link-entity",
  classe: "bg-accent border-accent",
  trait: "bg-accent border-accent",
};
const VIDE: Record<ColonneEgaliseur["genre"], string> = {
  emplacement: "bg-transparent border-edge-strong",
  pacte: "bg-transparent border-link-entity/70",
  classe: "bg-transparent border-accent/60",
  trait: "bg-transparent border-accent/60",
};

function Colonne({
  colonne,
  desactive,
  onGeste,
}: {
  colonne: ColonneEgaliseur;
  desactive: boolean;
  onGeste: (geste: GesteColonne, delta: number) => void;
}) {
  const t = useTranslations("egaliseur");
  const niveau = colonne.niveau ?? 0;
  const nom = colonne.libelle ?? "";
  const titre =
    colonne.genre === "pacte" ? t("pacte", { niveau }) : colonne.niveau !== undefined ? t("niveau", { niveau }) : nom;
  const depenser =
    colonne.genre === "pacte"
      ? t("depenserPacte", { niveau })
      : colonne.genre === "emplacement"
        ? t("depenserEmplacement", { niveau })
        : t("depenserRessource", { nom });
  const rendre =
    colonne.genre === "pacte"
      ? t("rendrePacte", { niveau })
      : colonne.genre === "emplacement"
        ? t("rendreEmplacement", { niveau })
        : t("rendreRessource", { nom });
  const restantsTexte = t("restants", { restants: colonne.restants, total: colonne.total });

  return (
    <div className="flex min-w-[2.25rem] flex-col items-center gap-1 px-1" title={`${titre} — ${restantsTexte}`}>
      {colonne.forme === "pastilles" ? (
        // Les pastilles se remplissent par le bas, comme un égaliseur.
        <div className="flex flex-col-reverse items-center">
          {Array.from({ length: colonne.total }, (_, i) => {
            const pleine = i < colonne.restants;
            return (
              <button
                key={i}
                type="button"
                disabled={desactive}
                aria-label={pleine ? depenser : rendre}
                onClick={() => onGeste(colonne.geste, pleine ? 1 : -1)}
                className="flex items-center justify-center p-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className={`block h-3 w-3 rounded-full border-[1.5px] ${pleine ? PLEIN[colonne.genre] : VIDE[colonne.genre]}`} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0.5 rounded-xl bg-panel-sunken px-1.5 py-1">
          <span className="mech font-display text-[17px] leading-none text-ink" aria-label={restantsTexte}>
            {colonne.restants}
          </span>
          <span className="text-xs text-ink-muted">/ {colonne.total}</span>
          <div className="flex gap-[3px]">
            <button
              type="button"
              disabled={desactive || colonne.restants <= 0}
              aria-label={depenser}
              onClick={() => onGeste(colonne.geste, 1)}
              className={`h-5 w-[22px] rounded border border-edge ${TAILLE_GLYPHE} text-ink disabled:cursor-not-allowed disabled:opacity-50`}
            >
              ▼
            </button>
            <button
              type="button"
              disabled={desactive || colonne.restants >= colonne.total}
              aria-label={rendre}
              onClick={() => onGeste(colonne.geste, -1)}
              className={`h-5 w-[22px] rounded border border-edge ${TAILLE_GLYPHE} text-ink disabled:cursor-not-allowed disabled:opacity-50`}
            >
              ▲
            </button>
          </div>
        </div>
      )}
      <span className="whitespace-nowrap text-xs text-ink-muted">{titre}</span>
      <span className="whitespace-nowrap text-xs text-ink-muted opacity-80">{t(`recharge.${colonne.recharge}`)}</span>
    </div>
  );
}

export default function Egaliseur({
  groupes,
  onGeste,
  desactive,
  emplacementsDesactives,
}: {
  groupes: GroupeEgaliseur[];
  onGeste: (geste: GesteColonne, delta: number) => void;
  /** Une action est en cours : plus aucun geste. */
  desactive: boolean;
  /** V3.1-109 : sans la commande `spell_slots`, les colonnes d'emplacement et de pacte ne se touchent pas. */
  emplacementsDesactives: boolean;
}) {
  const t = useTranslations("egaliseur");
  if (groupes.length === 0) return null;

  return (
    <div role="group" aria-label={t("ligne")} className="flex items-stretch overflow-x-auto rounded-md border border-edge/60 bg-panel-sunken px-1 py-2">
      {groupes.map((groupe, indice) => (
        <div
          key={groupe.cle}
          // Largeur proportionnelle au nombre de colonnes.
          style={{ flexGrow: groupe.colonnes.length }}
          className={`flex flex-col items-center gap-1.5 px-1 ${indice > 0 ? "border-l border-edge" : ""}`}
        >
          <span className="text-center text-xs font-bold uppercase leading-tight tracking-[0.08em] text-ink-soft">{t(`groupes.${groupe.cle}`)}</span>
          <div className="flex w-full flex-1 items-end justify-around">
            {groupe.colonnes.map((colonne, i) => (
              <div key={colonne.cle} className={`flex ${colonne.genre === "pacte" && i > 0 ? "ml-1 border-l border-edge pl-1" : ""}`}>
                <Colonne
                  colonne={colonne}
                  desactive={desactive || ((colonne.genre === "emplacement" || colonne.genre === "pacte") && emplacementsDesactives)}
                  onGeste={onGeste}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
