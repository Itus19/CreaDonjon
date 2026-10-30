"use client";

import { useTranslations } from "next-intl";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import { ABILITIES } from "@/src/core/rules/abilities";
import { ftToM } from "@/src/core/rules/encumbrance";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import { ABILITY_LABELS, SORTED_SKILLS } from "../sheetLabels";

const signe = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/**
 * V3.1-49 — L'aperçu en direct, à droite : le résultat calculé par le vrai
 * moteur de la fiche (`characterSheet`, le même que la fiche jouable), jamais
 * une approximation. La grille des dix-huit compétences y remplace l'ancien
 * onglet Compétences.
 */
export default function ApercuDirect({
  nom,
  ligne,
  sheet,
  pret,
  langues,
  traits,
  sorts,
}: {
  nom: string;
  ligne: string;
  sheet: DerivedSheet;
  /** Les règles sont arrivées : avant, la fiche est calculée sur des règles vides et ne s'affiche pas. */
  pret: boolean;
  langues: string[];
  traits: string[];
  sorts: string[];
}) {
  const t = useTranslations("creation");
  if (!pret) return <p className="text-xs text-ink-muted">{t("apercuChargement")}</p>;

  const liste = (valeurs: string[]) => (valeurs.length > 0 ? valeurs.join(", ") : "—");

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div>
        <div className="font-display text-base font-bold text-ink">{nom || t("sansNom")}</div>
        {ligne && <div className="text-ink-soft">{ligne}</div>}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {(
          [
            ["ca", sheet.ac.value],
            ["pv", sheet.hitPoints.max],
            ["vitesse", `${Math.round(ftToM(sheet.speed.value) * 10) / 10} m`],
            ["maitrise", signe(sheet.proficiencyBonus)],
          ] as const
        ).map(([cle, valeur]) => (
          <div key={cle} className="flex flex-col items-center rounded-md border border-edge bg-panel-sunken px-1 py-1 text-ink-muted">
            <span>{t(`stat.${cle}`)}</span>
            <span className="font-display text-base font-bold text-ink">{valeur}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1">
        {ABILITIES.map((a) => (
          <div key={a} className="flex flex-col items-center rounded-md border border-edge bg-panel-sunken py-1">
            <span className="text-ink-muted">{ABILITY_LABELS[a]}</span>
            <span className="font-display text-sm font-bold text-ink">{sheet.abilities[a].score}</span>
            <span className="text-ink-soft">{signe(sheet.abilities[a].mod)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-semibold uppercase tracking-wide text-ink-muted">{t("competences")}</span>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {SORTED_SKILLS.map((skill) => {
            const r = sheet.skills[skill];
            const maitrise = r.proficiency === "proficient" || r.proficiency === "expertise";
            return (
              <li key={skill} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${r.proficiency === "expertise" ? "bg-accent" : maitrise ? "border border-accent bg-accent/40" : "border border-edge"}`}
                />
                <span className={`min-w-0 flex-1 truncate ${maitrise ? "text-ink" : "text-ink-muted"}`}>
                  {SKILL_LABELS_FR[skill]}
                  {r.proficiency === "expertise" && <span className="sr-only"> ({t("expertise")})</span>}
                </span>
                <span className={maitrise ? "font-medium text-ink" : "text-ink-muted"}>{signe(r.mod)}</span>
              </li>
            );
          })}
        </ul>
      </div>
      {(
        [
          ["langues", langues],
          ["traits", traits],
          ["sorts", sorts],
        ] as const
      ).map(([cle, valeurs]) => (
        <p key={cle} className="leading-relaxed text-ink-soft">
          <span className="text-ink-muted">{t(`resume.${cle}`)} </span>
          {liste(valeurs)}
        </p>
      ))}
    </div>
  );
}
