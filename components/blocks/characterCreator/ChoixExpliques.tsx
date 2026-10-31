"use client";

import { useTranslations } from "next-intl";
import type { SousEtape } from "@/lib/ui/cheminCreation";
import type { ColonneOption } from "@/lib/ui/optionsAvecEffets";
import { NIVEAUX_TABLEAU } from "@/lib/ui/optionsAvecEffets";
import type { SkillChoiceEffect, SpellAbilityEffect } from "@/src/core/rules/choiceEffects";
import { toggleChoice } from "@/components/blocks/characterChoiceUtils";

/** Un clic : à une seule valeur il remplace ou retire, à plusieurs il remplit jusqu'au compte. */
function apresClic(sous: SousEtape, cle: string): string[] {
  const choisi = sous.choisis.includes(cle);
  return sous.nombre === 1 ? (choisi ? [] : [cle]) : toggleChoice(sous.choisis, cle, sous.nombre);
}

function signe(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

const CLASSE_CARTE = "flex flex-col gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45";

function classeCarte(choisi: boolean): string {
  return `${CLASSE_CARTE} ${choisi ? "border-accent bg-accent/10 text-accent" : "border-edge bg-panel-sunken text-ink hover:bg-panel-raised"}`;
}

/**
 * V3.1-50 — La caractéristique d'incantation d'un trait ou d'un don : elle dit
 * à quoi elle sert (le DD et l'attaque des sorts DE CE TRAIT, rien d'autre),
 * et chaque carte montre son effet chiffré par le moteur pour ce personnage.
 * Elle suit donc les valeurs de caractéristiques en direct.
 */
export function ChoixCaracIncantation({
  sous,
  effets,
  signalee,
  deLaClasse,
  libelleOption,
  onChoisir,
}: {
  sous: SousEtape;
  effets: readonly SpellAbilityEffect[];
  /** L'option à signaler (`bestSpellAbility`). */
  signalee: string | null;
  /** La signalée est la caractéristique d'incantation d'une classe choisie, pas seulement la meilleure. */
  deLaClasse: boolean;
  libelleOption: (cle: string) => string;
  onChoisir: (valeurs: string[]) => void;
}) {
  const t = useTranslations("creation.caracIncantation");
  const tc = useTranslations("creation");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink-soft">{t("explication")}</p>
      <p className="text-xs text-ink-muted">
        {sous.nombre > 1 ? tc("choisirN", { n: sous.nombre }) : tc("choisirUn")}{" "}
        <span className="font-semibold text-accent">{tc("compte", { fait: sous.choisis.length, total: sous.nombre })}</span>
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
        {effets.map((e) => {
          const choisi = sous.choisis.includes(e.ability);
          return (
            <button key={e.ability} type="button" aria-pressed={choisi} onClick={() => onChoisir(apresClic(sous, e.ability))} className={classeCarte(choisi)}>
              <span className="font-semibold">{libelleOption(e.ability)}</span>
              <span className="text-xs font-normal text-ink-muted">{t("effet", { mod: signe(e.mod), dd: e.saveDc, attaque: signe(e.attackBonus) })}</span>
              {signalee === e.ability && (
                <span className="w-fit rounded-full border border-accent/60 px-2 py-0.5 text-xs font-normal text-accent">
                  {deLaClasse ? t("saClasse") : t("laMeilleure")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * V3.1-50 — Un choix de compétence (Sens aiguisés, Compétent) : ce que
 * couvre chaque compétence, le total qu'elle donnerait, et — quand une autre
 * source la rend déjà maîtrisée — que ce choix ne donnerait rien de plus.
 */
export function ChoixCompetence({
  sous,
  effets,
  libelleOption,
  onChoisir,
}: {
  sous: SousEtape;
  effets: readonly SkillChoiceEffect[];
  libelleOption: (cle: string) => string;
  onChoisir: (valeurs: string[]) => void;
}) {
  const t = useTranslations("creation.competence");
  const tc = useTranslations("creation");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">
        {sous.nombre > 1 ? tc("choisirN", { n: sous.nombre }) : tc("choisirUn")}{" "}
        <span className="font-semibold text-accent">{tc("compte", { fait: sous.choisis.length, total: sous.nombre })}</span>
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2">
        {effets.map((e) => {
          const choisi = sous.choisis.includes(e.skill);
          const bloque = !choisi && sous.nombre > 1 && sous.choisis.length >= sous.nombre;
          return (
            <button
              key={e.skill}
              type="button"
              aria-pressed={choisi}
              disabled={bloque}
              onClick={() => onChoisir(apresClic(sous, e.skill))}
              className={`${classeCarte(choisi)} ${e.alreadyFrom && !choisi ? "opacity-70" : ""}`}
            >
              <span className="font-semibold">{libelleOption(e.skill)}</span>
              <span className="text-xs font-normal text-ink-muted">{t.has(`couvre.${e.skill}`) ? t(`couvre.${e.skill}`) : ""}</span>
              <span className="text-xs font-normal text-ink">{t("total", { total: signe(e.ifChosen) })}</span>
              {e.alreadyFrom && <span className="text-xs font-normal text-accent">{t("dejaMaitrisee", { source: e.alreadyFrom })}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * V3.1-50 — Lignage, legs, lignage gnomique : une colonne par option, ce
 * qu'elle donne aux niveaux 1, 3 et 5. Toucher une colonne la choisit. Étroit
 * (téléphone), les colonnes s'empilent : une carte par option.
 */
export function TableauOptions({ sous, colonnes, onChoisir }: { sous: SousEtape; colonnes: readonly ColonneOption[]; onChoisir: (valeurs: string[]) => void }) {
  const t = useTranslations("creation.tableau");
  const tc = useTranslations("creation");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">
        {sous.nombre > 1 ? tc("choisirN", { n: sous.nombre }) : tc("choisirUn")}{" "}
        <span className="font-semibold text-accent">{tc("compte", { fait: sous.choisis.length, total: sous.nombre })}</span>
      </p>
      <div className="grid grid-cols-1 gap-2 @lg/creation:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
        {colonnes.map((c) => {
          const choisi = sous.choisis.includes(c.id);
          const bloque = !choisi && sous.nombre > 1 && sous.choisis.length >= sous.nombre;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={choisi}
              disabled={bloque}
              onClick={() => onChoisir(apresClic(sous, c.id))}
              className={`${classeCarte(choisi)} items-stretch gap-2`}
            >
              <span className="font-semibold">{c.libelle}</span>
              {NIVEAUX_TABLEAU.map((n) => (
                <span key={n} className="flex flex-col gap-0.5 border-t border-edge/60 pt-1">
                  <span className="text-xs text-ink-muted">{t("niveau", { n })}</span>
                  {c.parNiveau[n].length === 0 ? (
                    <span className="text-xs font-normal text-ink-muted">{t("rien")}</span>
                  ) : (
                    c.parNiveau[n].map((ligne) => (
                      <span key={ligne} className="text-sm font-normal text-ink">
                        {ligne}
                      </span>
                    ))
                  )}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
