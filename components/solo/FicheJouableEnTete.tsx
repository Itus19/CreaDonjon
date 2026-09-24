"use client";

import { useState } from "react";
import type { Ability, DerivedSheet, Skill } from "@/src/core/rules/sheet";
import { SKILL_ABILITIES } from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import { ABILITY_LABELS, SORTED_SKILLS } from "@/components/blocks/PlayableCharacterSheet";

/**
 * V3-D5 — Le haut de la fiche jouable au format étroit : le nom, les états,
 * la ligne d'identité, la rangée d'état chiffré (bouclier de CA, trois
 * jauges circulaires, trois faits constants), puis les caractéristiques en
 * grille et les compétences repliées.
 *
 * Conçu et vérifié dans l'esquisse (`components/solo/esquisse/`, huit
 * passes avec l'auteur, décisions datées du 23 septembre) — ce fichier en
 * reprend le dessin au pixel près, câblé sur de vraies données. L'esquisse
 * elle-même n'est jamais importée : elle est jetable, ce fichier ne l'est
 * pas.
 */

/**
 * Une jauge circulaire — PV, niveau, épuisement (bandeau), et la charge du
 * Sac (V3-D5, onglet Sac) : une seule forme pour « une part d'un tout »
 * dans toute la colonne.
 *
 * Le clic bascule le chiffre en pourcentage, et CHAQUE jauge garde son
 * propre affichage — « combien de PV me reste-t-il » et « où j'en suis du
 * niveau » ne se lisent pas de la même façon.
 *
 * `pathLength={100}` : le navigateur renormalise la circonférence, le
 * tiret se donne directement en pourcents, rien à recalculer si le
 * diamètre change.
 */
export function JaugeCirculaire({
  libelle,
  valeur,
  pct,
  ton = "accent",
  titre,
  petite = false,
}: {
  /** Absent quand la valeur se suffit — la charge du Sac porte sa fraction dans l'anneau, sans légende dessous. */
  libelle?: string;
  valeur: React.ReactNode;
  pct: number;
  ton?: "accent" | "danger";
  titre: string;
  /** 44 px plutôt que 48 — la charge du Sac, dont la fraction sur deux lignes a besoin de plus de corde. */
  petite?: boolean;
}) {
  const [enPourcent, setEnPourcent] = useState(false);
  const borne = Math.max(0, Math.min(100, pct));

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`relative ${petite ? "h-11 w-11" : "h-12 w-12"}`}>
        <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-panel-sunken" />
          {/* `strokeLinecap` : un cap arrondi sur une valeur nulle dessine quand même un point — a zero, la jauge doit etre VIDE. */}
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            strokeWidth="4"
            strokeLinecap={borne === 0 ? "butt" : "round"}
            pathLength={100}
            strokeDasharray={`${borne} ${100 - borne}`}
            className={ton === "danger" ? "stroke-danger" : "stroke-accent"}
          />
        </svg>
        {/* Le bouton EST le centre de l'anneau : 40 px de cible dans 48 de jauge (32 dans 44 pour la petite) — jamais sous 24 (V2.1-27). */}
        <button
          type="button"
          onClick={() => setEnPourcent((v) => !v)}
          title={titre}
          aria-label={`${titre} — ${enPourcent ? "afficher la valeur" : "afficher le pourcentage"}`}
          className="absolute inset-1 flex items-center justify-center rounded-full text-xs font-medium text-ink transition-colors hover:text-accent"
        >
          {enPourcent ? `${borne} %` : valeur}
        </button>
      </div>
      {libelle !== undefined && <span className="text-xs text-ink-muted">{libelle}</span>}
    </div>
  );
}

/**
 * La CA en bouclier — le même `clipPath` que `CharacterSheetHeader.tsx`, au
 * caractère près : la fiche et l'écran solo montrent la même chose, ils la
 * dessinent pareil. Pas d'anneau : un anneau dit une proportion, une classe
 * d'armure n'a pas de maximum.
 */
function Bouclier({ valeur }: { valeur: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="flex h-12 w-9 items-center justify-center border-2 border-accent bg-panel-raised"
        style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
        title="Classe d'armure — calculée, jamais saisie"
      >
        <span className="text-sm font-bold text-ink">{valeur}</span>
      </div>
      <span className="text-xs text-ink-muted">CA</span>
    </div>
  );
}

/**
 * Vitesse, bonus de maîtrise, inspiration : des CONSTANTES de la fiche, pas
 * des compteurs qui bougent en jouant — jamais une jauge de plus, qui leur
 * promettrait un mouvement qu'elles n'ont pas.
 */
function TroisFaits({ vitesse, maitrise, inspiration }: { vitesse: string; maitrise: string; inspiration: number }) {
  return (
    <div className="grid grid-cols-[auto_auto] items-center gap-x-1.5 pt-0.5 text-xs">
      <span className="text-ink-muted">VIT</span>
      <span className="text-ink">{vitesse}</span>
      <span className="text-ink-muted">MAÎT</span>
      <span className="text-ink">{maitrise}</span>
      <span className="text-ink-muted">INSP</span>
      <span className={inspiration > 0 ? "text-accent" : "text-ink-muted"}>{inspiration > 0 ? "✦".repeat(inspiration) : "—"}</span>
    </div>
  );
}

export default function FicheJouableEnTete({
  name,
  identityLine,
  conditions,
  ac,
  hpCurrent,
  hpMax,
  level,
  xpCurrent,
  xpCeiling,
  exhaustion,
  speed,
  proficiencyBonus,
  inspiration,
}: {
  name: string;
  identityLine: string;
  conditions: string[];
  ac: number;
  hpCurrent: number;
  hpMax: number;
  level: number;
  xpCurrent: number;
  xpCeiling: number;
  /** 0-6 : la borne de `zRuntimeState` (le niveau 6 est la mort), jamais un maximum inventé. */
  exhaustion: number;
  speed: string;
  proficiencyBonus: string;
  inspiration: number;
}) {
  const pctPv = hpMax > 0 ? Math.round((hpCurrent / hpMax) * 100) : 0;
  const pctXp = xpCeiling > 0 ? Math.round((xpCurrent / xpCeiling) * 100) : 0;
  // 6, jamais un maximum invente : `zRuntimeState` borne l'epuisement a `.min(0).max(6)`.
  const pctEpuisement = Math.round((exhaustion / 6) * 100);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-chrome text-base font-medium text-ink">{name}</span>
        {conditions.map((etat) => (
          <span key={etat} className="rounded-full border border-danger px-2 py-0.5 text-xs text-danger">
            {etat}
          </span>
        ))}
      </div>
      <span className="text-xs text-ink-muted">{identityLine}</span>

      {/* Tout l'état chiffré sur UNE rangée, espacée régulièrement
          (`justify-between`) — les largeurs diffèrent, les intervalles non.
          Aucune ligne de légende dessous : c'est là qu'est la place gagnée. */}
      <div className="flex items-start justify-between gap-1">
        <Bouclier valeur={ac} />
        <JaugeCirculaire libelle="PV" valeur={`${hpCurrent}/${hpMax}`} pct={pctPv} titre={`${hpCurrent} points de vie sur ${hpMax}`} />
        {/* Sous la jauge, le niveau ATTEINT ; dedans, la marche vers le suivant — jamais le mot "XP". Le seuil vit dans l'infobulle. */}
        <JaugeCirculaire
          libelle={`Niv. ${level}`}
          valeur={xpCurrent.toLocaleString("fr-FR")}
          pct={pctXp}
          titre={`${xpCurrent.toLocaleString("fr-FR")} XP — niveau ${level + 1} à ${xpCeiling.toLocaleString("fr-FR")}`}
        />
        {/* L'épuisement monte quand ça va mal : son anneau se remplit à l'envers des deux autres, d'où le ton d'alerte. */}
        <JaugeCirculaire libelle="Épuis." valeur={`${exhaustion}/6`} pct={pctEpuisement} ton="danger" titre={`Épuisement ${exhaustion} sur 6`} />
        <TroisFaits vitesse={speed} maitrise={proficiencyBonus} inspiration={inspiration} />
      </div>
    </div>
  );
}

/**
 * Les caractéristiques en grille (retenue le 23 septembre parmi trois
 * refontes comparées dans l'esquisse), puis les compétences repliées sous
 * elles — un `<details>`, pas un sixième onglet : six onglets ne tiennent
 * pas dans 300 px.
 *
 * Lecture et jet seulement : éditer le score de base d'une caractéristique
 * ou choisir une compétence à la création reste le travail de la fiche
 * complète (`/joueur/wiki/:slug`) — cette colonne sert une partie en cours,
 * pas la construction du personnage.
 */
export function CaracteristiquesEtCompetences({
  sheet,
  onRollAbility,
  onRollSave,
  onRollSkill,
}: {
  sheet: DerivedSheet;
  onRollAbility: (ability: Ability) => void;
  onRollSave: (ability: Ability) => void;
  onRollSkill: (skill: Skill) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1">
        {(Object.keys(ABILITY_LABELS) as Ability[]).map((ability) => {
          const mod = sheet.abilities[ability].mod;
          const save = sheet.savingThrows[ability];
          return (
            <div key={ability} className="flex flex-col items-center rounded-md border border-edge px-1 py-0.5">
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-ink-muted">{ABILITY_LABELS[ability]}</span>
                <span className="text-xs tabular-nums text-ink-soft" title={`Score de ${ABILITY_LABELS[ability]}`}>
                  {sheet.abilities[ability].score}
                </span>
              </div>
              <div className="flex w-full items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onRollAbility(ability)}
                  className="flex h-6 flex-1 items-center justify-center rounded text-sm font-medium tabular-nums text-ink transition-colors hover:bg-panel-sunken"
                  title={`Lancer un test de ${ABILITY_LABELS[ability]}`}
                >
                  {mod >= 0 ? "+" : ""}
                  {mod}
                </button>
                <button
                  type="button"
                  onClick={() => onRollSave(ability)}
                  className="flex h-6 flex-1 items-center justify-center rounded text-xs tabular-nums text-ink-muted transition-colors hover:bg-panel-sunken"
                  title={`Lancer une sauvegarde de ${ABILITY_LABELS[ability]}`}
                >
                  {save.mod >= 0 ? "+" : ""}
                  {save.mod}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <details className="rounded-md border border-edge px-2 py-1.5">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-muted">Compétences</summary>
        <div className="mt-1 flex flex-col gap-0.5">
          {SORTED_SKILLS.map((skill) => {
            const result = sheet.skills[skill];
            return (
              <button
                key={skill}
                type="button"
                onClick={() => onRollSkill(skill)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-panel-sunken"
                title={`Lancer ${SKILL_LABELS_FR[skill]}`}
              >
                <span className="flex-1 text-sm text-ink">{SKILL_LABELS_FR[skill]}</span>
                <span className="text-xs uppercase text-ink-muted">{ABILITY_LABELS[SKILL_ABILITIES[skill]]}</span>
                <span className="w-8 text-right text-sm font-medium text-ink">
                  {result.mod >= 0 ? "+" : ""}
                  {result.mod}
                </span>
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
