import { ABILITIES, SKILLS } from "@/src/core/rules/abilities";
import { localizedLabel, type ChoiceSource, type FeatChoiceData, type OpenChoice } from "@/src/core/rules/choices";
import { SPELL_DAMAGE_TYPES } from "@/src/core/rules/homebrewSpell";
import type { ChoiceFrom } from "@/src/core/schemas/rule-blocks/choices";
import type { RemainingChoiceView } from "@/components/blocks/useResolvedRuleset";

/**
 * V3.1-49 — Le chemin de création qui se ramifie : les étapes à gauche, et
 * sous chacune les choix qu'elle fait naître. Pur et recalculé à chaque
 * rendu : un choix existe parce que sa source est choisie, jamais parce qu'il
 * a été mémorisé. Changer d'espèce fait donc disparaître sa cascade, sans
 * effacer les réponses (une espèce rechoisie les retrouve).
 *
 * Deux origines de choix, rangées ensemble :
 * - les choix accordés (`resolveChoices`, V3.1-116) : traits, dons, options,
 *   aptitudes de classe ; leur fiche dit d'où ils viennent (`origin`) ;
 * - les anciens choix restants (compétences de classe, langues du
 *   personnage, maîtrise d'armes) ; le serveur dit aussi leur origine.
 *
 * Une position du parcours est une clé d'étape (`espece`) ou une clé de
 * choix préfixée (`c:versatile.feat`).
 */

export type CleEtape = "ident" | "espece" | "classe" | "carac" | "pv" | "histo" | "equip" | "sorts" | "apercu";

export interface OptionChoix {
  cle: string;
  /** Libellé porté par la donnée (don, option nommée, sort). Absent : l'écran le traduit (compétence, langue, caractéristique). */
  libelle?: string;
}

export interface SousEtape {
  cle: string;
  etape: CleEtape;
  libelle: string;
  /** D'où vient le choix, pour l'en-tête de son écran : « Polyvalent → Initié à la magie ». */
  source: string;
  nombre: number;
  choisis: string[];
  options: OptionChoix[];
  genre: ChoiceFrom["kind"] | "weapon_mastery";
  /** La réponse est imposée par une autre fiche (Argot des voleurs) : acquise, rien à choisir. */
  impose: boolean;
  fait: boolean;
  /** L'expertise attend des compétences maîtrisées : aucune option tant qu'il n'y en a pas. */
  attend: boolean;
}

export interface Etape {
  cle: CleEtape;
  sous: SousEtape[];
  aFaire: number;
}

export interface Chemin {
  etapes: Etape[];
  /** Positions dans l'ordre de Précédent / Suivant : chaque étape, puis ses sous-étapes. */
  ordre: string[];
  aFaire: number;
}

export interface SortCandidat {
  cle: string;
  libelle: string;
  niveau?: number;
  listes?: readonly string[];
}

export interface EntreeChemin {
  restants: readonly RemainingChoiceView[];
  ouverts: readonly OpenChoice[];
  sources: readonly ChoiceSource[];
  reponses: Readonly<Record<string, unknown>>;
  avecPointsDeVie: boolean;
  avecSorts: boolean;
  /** Les langues proposables (clés). */
  langues: readonly string[];
  /** Ce qu'une expertise peut viser (`ResolvedChoices.proficientSkills`). */
  competencesMaitrisees: readonly string[];
  dons: Readonly<Record<string, FeatChoiceData>>;
  /** Les sorts du monde, pour un choix de sort. Absent : aucune option tant que le catalogue n'est pas là. */
  sorts?: readonly SortCandidat[];
}

const ORDRE_ETAPES: readonly CleEtape[] = ["ident", "espece", "classe", "carac", "pv", "histo", "equip", "sorts", "apercu"];

const ETAPE_DE_L_ORIGINE: Record<NonNullable<ChoiceSource["origin"]> | RemainingChoiceView["origin"], CleEtape> = {
  character: "ident",
  species: "espece",
  class: "classe",
  background: "histo",
};

function asKeys(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v !== "") : [];
}

/** La fiche racine d'une clé de choix : celle dont la clé préfixe le plus longuement. */
function racine(cle: string, sources: readonly ChoiceSource[]): ChoiceSource | undefined {
  let meilleure: ChoiceSource | undefined;
  for (const s of sources) {
    if ((cle === s.key || cle.startsWith(`${s.key}.`)) && (!meilleure || s.key.length > meilleure.key.length)) meilleure = s;
  }
  return meilleure;
}

function optionsAccordees(choix: OpenChoice, entree: EntreeChemin, languesPrises: ReadonlySet<string>): { options: OptionChoix[]; attend: boolean } {
  const from = choix.from;
  switch (from.kind) {
    case "skill": {
      // Le SRD écrit « animal-handling », la fiche « animal_handling » (même normalisation que le noyau).
      const permises: readonly string[] = from.options?.map((o) => o.replace(/-/g, "_")) ?? SKILLS;
      if (from.expertise) {
        const options = entree.competencesMaitrisees.filter((s) => permises.includes(s)).map((cle) => ({ cle }));
        return { options, attend: options.length === 0 };
      }
      return { options: permises.map((cle) => ({ cle })), attend: false };
    }
    case "language":
      return { options: (from.options ?? entree.langues.filter((l) => !languesPrises.has(l) || choix.chosen.includes(l))).map((cle) => ({ cle })), attend: false };
    case "tool":
      return { options: (from.options ?? []).map((cle) => ({ cle })), attend: false };
    case "ability":
      return { options: (from.options ?? ABILITIES).map((cle) => ({ cle })), attend: false };
    case "damage_type":
      return { options: (from.options ?? SPELL_DAMAGE_TYPES).map((cle) => ({ cle })), attend: false };
    case "option":
      return { options: from.options.map((o) => ({ cle: o.id, libelle: localizedLabel(o.label, o.id) })), attend: false };
    case "feat":
      return {
        options: Object.values(entree.dons)
          .filter((d) => from.category === undefined || d.category === from.category)
          .map((d) => ({ cle: d.key, libelle: d.label })),
        attend: false,
      };
    case "spell": {
      const options = (entree.sorts ?? []).filter((s) => {
        if (from.level !== undefined && s.niveau !== undefined && s.niveau !== from.level) return false;
        if (from.max_level !== undefined && s.niveau !== undefined && s.niveau > from.max_level) return false;
        const listes = from.list ? [from.list] : from.lists;
        if (listes && s.listes && !listes.some((l) => s.listes?.includes(l))) return false;
        return true;
      });
      return { options: options.map((s) => ({ cle: s.cle, libelle: s.libelle })), attend: false };
    }
  }
}

export function construireChemin(entree: EntreeChemin): Chemin {
  const sous: SousEtape[] = [];
  const clesAccordees = new Set(entree.ouverts.map((c) => c.key));

  // Les langues déjà acquises ailleurs ne se proposent plus (l'Argot des voleurs, une langue choisie sous Identité).
  const languesPrises = new Set<string>();
  for (const c of entree.ouverts) if (c.from.kind === "language") for (const l of c.chosen) languesPrises.add(l);
  for (const r of entree.restants) if (r.kind === "language") for (const l of asKeys(entree.reponses[r.id])) languesPrises.add(l);

  for (const r of entree.restants) {
    if (clesAccordees.has(r.id)) continue;
    const choisis = asKeys(entree.reponses[r.id]).filter((v) => r.options.includes(v)).slice(0, r.count);
    sous.push({
      cle: r.id,
      etape: ETAPE_DE_L_ORIGINE[r.origin],
      libelle: r.label,
      source: r.label,
      nombre: r.count,
      choisis,
      options: r.options.map((cle) => ({ cle })),
      genre: r.kind,
      impose: false,
      fait: choisis.length >= r.count,
      attend: false,
    });
  }

  for (const c of entree.ouverts) {
    const fiche = racine(c.key, entree.sources);
    const etape = fiche?.origin ? ETAPE_DE_L_ORIGINE[fiche.origin] : "classe";
    const don = c.sourceKey !== fiche?.key ? entree.dons[c.sourceKey.split(".").pop() ?? ""] : undefined;
    const { options, attend } = c.preset ? { options: c.chosen.map((cle) => ({ cle })), attend: false } : optionsAccordees(c, entree, languesPrises);
    sous.push({
      cle: c.key,
      etape,
      libelle: c.label,
      source: [fiche?.label, don?.label].filter(Boolean).join(" → "),
      nombre: c.count,
      choisis: c.chosen,
      options,
      genre: c.from.kind,
      impose: c.preset,
      fait: c.chosen.length >= c.count,
      attend,
    });
  }

  const etapes: Etape[] = ORDRE_ETAPES.filter((cle) => (cle !== "pv" || entree.avecPointsDeVie) && (cle !== "sorts" || entree.avecSorts)).map((cle) => {
    const ici = sous.filter((s) => s.etape === cle);
    return { cle, sous: ici, aFaire: ici.filter((s) => !s.fait).length };
  });

  const ordre = etapes.flatMap((e) => [e.cle, ...e.sous.map((s) => `c:${s.cle}`)]);
  return { etapes, ordre, aFaire: etapes.reduce((n, e) => n + e.aFaire, 0) };
}

/** La position suivante (`sens` 1) ou précédente (-1) ; une position inconnue repart de la première étape. */
export function voisin(chemin: Chemin, position: string, sens: 1 | -1): string {
  const i = Math.max(0, chemin.ordre.indexOf(position));
  return chemin.ordre[Math.min(chemin.ordre.length - 1, Math.max(0, i + sens))];
}

/** Une position existe encore dans le chemin (un choix disparaît quand sa source change). */
export function positionValide(chemin: Chemin, position: string): boolean {
  return chemin.ordre.includes(position);
}

/** L'étape qui contient une position. */
export function etapeDe(chemin: Chemin, position: string): CleEtape | null {
  if (!position.startsWith("c:")) return chemin.etapes.some((e) => e.cle === position) ? (position as CleEtape) : null;
  const cle = position.slice(2);
  return chemin.etapes.find((e) => e.sous.some((s) => s.cle === cle))?.cle ?? null;
}
