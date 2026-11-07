"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import type { SousEtape } from "@/lib/ui/cheminCreation";
import { toggleChoice } from "@/components/blocks/characterChoiceUtils";
import { ASI_FEAT_KEY } from "@/src/core/rules/abilityScoreImprovement";
import type { FeatChoiceData } from "@/src/core/rules/choices";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import {
  useRuleEntryBlocks,
  type RuleEntryBlockData,
} from "../useRuleEntryBlocks";
import AsiStep from "../characterCreatorSteps/AsiStep";

/** Ce dont le +2 / +1+1 a besoin quand le don choisi est « Amélioration de caractéristique ». */
export interface ContexteAmelioration {
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  sheet: DerivedSheet;
  abilityScoreCap: number | undefined;
  nomClasse: (classKey: string) => string;
}

function prerequis(blocs: RuleEntryBlockData[] | undefined): string[] {
  const bloc = blocs?.find((b) => b.blockType === "prerequisites");
  const items = (bloc?.data as { items?: unknown } | undefined)?.items;
  return Array.isArray(items)
    ? items.filter((i): i is string => typeof i === "string" && i !== "")
    : [];
}

/**
 * V3.1-118 — Le sélecteur d'un choix de don : une carte par don proposé (nom,
 * catégorie, prérequis). V3.1-172 (esquisse, solution B) : plus d'extrait
 * coupé sur la carte ; le don touché s'affiche en entier sous la grille, comme
 * la fiche de l'espèce ou de l'historique. Les blocs des dons viennent
 * d'UNE requête (`useRuleEntryBlocks`), limitée aux dons de ce choix. Un don
 * déjà acquis ailleurs reste visible, grisé. Si le don choisi est
 * « Amélioration de caractéristique » d'un niveau de classe, le +2 / +1+1 de CE
 * niveau se règle dessous.
 */
export default function ChoixDon({
  worldSlug,
  sous,
  dons,
  dejaAcquis,
  amelioration,
  onChoisir,
}: {
  worldSlug: string;
  sous: SousEtape;
  dons: Readonly<Record<string, FeatChoiceData>>;
  dejaAcquis: ReadonlySet<string>;
  amelioration: ContexteAmelioration;
  onChoisir: (valeurs: string[]) => void;
}) {
  const t = useTranslations("creation");
  const blocs = useRuleEntryBlocks(
    worldSlug,
    sous.options.map((o) => o.cle),
  );
  // Le don dont la fiche s'affiche sous la grille : le dernier touché, sinon le premier choisi.
  const [touche, setTouche] = useState<string | null>(null);

  if (sous.impose) {
    return (
      <p className="text-sm text-ink-soft">
        {t("impose", {
          valeurs: sous.choisis
            .map((c) => sous.options.find((o) => o.cle === c)?.libelle ?? c)
            .join(", "),
        })}
      </p>
    );
  }
  if (sous.options.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-edge px-3 py-2 text-sm text-ink-muted">
        {t("aucuneOption")}
      </p>
    );
  }

  const complet = sous.choisis.length >= sous.nombre;
  const niveauDeClasse = /^(.+)\.l(\d+)\.feat$/.exec(sous.cle);
  const afficherAmelioration =
    niveauDeClasse !== null && sous.choisis[0] === ASI_FEAT_KEY;

  function nomCategorie(categorie: string): string {
    return t.has(`choixDon.categories.${categorie}`)
      ? t(`choixDon.categories.${categorie}`)
      : categorie;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">
        {sous.nombre > 1 ? t("choisirN", { n: sous.nombre }) : t("choisirUn")}{" "}
        <span className="font-semibold text-accent">
          {t("compte", { fait: sous.choisis.length, total: sous.nombre })}
        </span>
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
        {sous.options.map((o) => {
          const choisi = sous.choisis.includes(o.cle);
          const acquis = !choisi && dejaAcquis.has(o.cle);
          const bloque = acquis || (!choisi && complet && sous.nombre > 1);
          const categorie = dons[o.cle]?.category;
          const conditions = prerequis(blocs[o.cle]);
          return (
            <button
              key={o.cle}
              type="button"
              aria-pressed={choisi}
              aria-disabled={bloque}
              onClick={() => {
                setTouche(o.cle);
                if (bloque) return;
                onChoisir(
                  sous.nombre === 1
                    ? choisi
                      ? []
                      : [o.cle]
                    : toggleChoice(sous.choisis, o.cle, sous.nombre),
                );
              }}
              className={`flex flex-col gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-45 ${
                choisi
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-edge bg-panel-sunken text-ink hover:bg-panel-raised"
              }`}
            >
              <span className="font-semibold">{o.libelle ?? o.cle}</span>
              {categorie && (
                <span className="text-xs font-normal text-ink-muted">
                  {t("choixDon.categorie", { nom: nomCategorie(categorie) })}
                </span>
              )}
              {conditions.length > 0 && (
                <span className="text-xs font-normal text-ink-muted">
                  {t("choixDon.prerequis", { liste: conditions.join(", ") })}
                </span>
              )}
              {acquis && (
                <span className="text-xs font-normal text-ink-muted">
                  {t("dejaAcquis")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(() => {
        const vu = sous.options.find((o) => o.cle === (touche ?? sous.choisis[0]));
        if (!vu) return null;
        const description = blocs[vu.cle]?.find((b) => b.blockType === "description");
        const categorie = dons[vu.cle]?.category;
        return (
          <article aria-label={vu.libelle ?? vu.cle} className="flex flex-col gap-1.5 rounded-md border border-edge/60 bg-panel-sunken p-3">
            <header className="flex flex-col gap-0.5">
              <h3 className="font-display text-base font-bold text-ink">{vu.libelle ?? vu.cle}</h3>
              {categorie && <p className="text-xs text-ink-muted">{t("choixDon.categorie", { nom: nomCategorie(categorie) })}</p>}
            </header>
            {blocs[vu.cle] === undefined ? (
              <p className="text-xs text-ink-muted">{t("fiche.chargement")}</p>
            ) : description ? (
              <div className="text-sm text-ink-soft">{renderBlockData("description", description.data, worldSlug)}</div>
            ) : (
              <p className="text-xs text-ink-muted">{t("fiche.sansTexte")}</p>
            )}
          </article>
        );
      })()}

      {afficherAmelioration && niveauDeClasse && (
        <AsiStep
          character={amelioration.character}
          patchCharacter={amelioration.patchCharacter}
          sheet={amelioration.sheet}
          abilityScoreCap={amelioration.abilityScoreCap}
          grants={[
            {
              choiceKey: sous.cle.replace(/\.feat$/, ".asi"),
              className: amelioration.nomClasse(niveauDeClasse[1]),
              level: Number(niveauDeClasse[2]),
            },
          ]}
        />
      )}
    </div>
  );
}
