"use client";

import { useTranslations } from "next-intl";
import { ABILITIES, type Ability, type DerivedSheet } from "@/src/core/rules/sheet";
import { ABILITY_LABELS } from "../sheetLabels";

/** Ce que la montée de niveau compare : la fiche calculée avant et après. */
export interface ResumeFiche {
  niveau: number;
  ca: number;
  pv: number;
  maitrise: number;
  caracteristiques: Record<Ability, number>;
}

export function resumeFiche(sheet: DerivedSheet, niveau: number): ResumeFiche {
  return {
    niveau,
    ca: sheet.ac.value,
    pv: sheet.hitPoints.max,
    maitrise: sheet.proficiencyBonus,
    caracteristiques: Object.fromEntries(ABILITIES.map((a) => [a, sheet.abilities[a].score])) as Record<Ability, number>,
  };
}

/**
 * V3.1-51 — « Avant → après » de la montée de niveau : niveau, points de vie,
 * classe d'armure, maîtrise, et les seules caractéristiques qui changent.
 * Les valeurs viennent du moteur (`characterSheet`), pas d'un calcul propre à
 * l'écran. Les points de vie sont une estimation tant qu'un niveau attend son
 * jet : le serveur le lance à la validation (règle 8).
 */
export default function AvantApres({
  avant,
  apres,
  nouveautes,
  estimation,
}: {
  avant: ResumeFiche;
  apres: ResumeFiche;
  nouveautes: string[];
  estimation: boolean;
}) {
  const t = useTranslations("creation.avantApres");
  const lignes: { cle: string; libelle: string; a: string; b: string }[] = [
    { cle: "niveau", libelle: t("niveau"), a: String(avant.niveau), b: String(apres.niveau) },
    { cle: "pv", libelle: t("pv"), a: String(avant.pv), b: `${estimation ? "≈ " : ""}${apres.pv}` },
    { cle: "ca", libelle: t("ca"), a: String(avant.ca), b: String(apres.ca) },
    { cle: "maitrise", libelle: t("maitrise"), a: `+${avant.maitrise}`, b: `+${apres.maitrise}` },
    ...ABILITIES.filter((a) => avant.caracteristiques[a] !== apres.caracteristiques[a]).map((a) => ({
      cle: a,
      libelle: ABILITY_LABELS[a],
      a: String(avant.caracteristiques[a]),
      b: String(apres.caracteristiques[a]),
    })),
  ];
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("titre")}</span>
      <dl className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 gap-y-1 text-sm">
        {lignes.map((l) => (
          <div key={l.cle} className="contents">
            <dt className="text-ink-muted">{l.libelle}</dt>
            <dd className="text-right text-ink-muted">{l.a}</dd>
            <dd aria-hidden="true" className="text-accent">
              →
            </dd>
            <dd className="text-right font-bold text-ink">{l.b}</dd>
          </div>
        ))}
      </dl>
      {estimation && <p className="text-xs text-ink-muted">{t("estimation")}</p>}
      {nouveautes.length > 0 && (
        <p className="text-sm text-ink-soft">
          <i className="not-italic text-ink-muted">{t("nouveau")}</i> {nouveautes.join(", ")}
        </p>
      )}
    </div>
  );
}
