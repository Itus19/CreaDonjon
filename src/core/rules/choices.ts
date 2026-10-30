import { ABILITIES, SKILLS, type Ability } from "./abilities";
import { resolveDeclaredModifiers, type DeclaredModifier, type FeatureSpell, type Layer, type Modifier, type ResolvedFeature } from "./sheet";
import type { ChoiceFrom, ChoiceGrant, ChoiceOption, FreeCast } from "../schemas/rule-blocks/choices";

/**
 * Résolution des choix accordés (V3.1-116, ADR 0046). Pure : elle reçoit
 * les choix que portent les fiches du personnage, ses réponses
 * (`character.choices`) et son niveau, et rend ce qui reste à choisir et
 * les effets de ce qui l'est déjà.
 *
 * Clé d'une réponse : `<source>.<choix>` au premier niveau, puis
 * `<clé du choix>.<option>.<choix>` sous une option, et
 * `<clé du choix>.<don>.<choix>` sous un don choisi. Une clé ne dépend donc
 * que du chemin suivi, jamais d'un ordre d'affichage.
 *
 * Ce qui n'est pas valide n'a aucun effet et n'est jamais deviné : option ou
 * don inconnu, compétence hors des options, sort hors de sa liste. La
 * réponse reste stockée telle quelle ; seule la fiche calculée l'ignore.
 */

/** Une fiche qui porte des choix : trait d'espèce, don, historique, aptitude. */
export interface ChoiceSource {
  key: string;
  label: string;
  /** Couche des modificateurs que ses choix produisent (espèce 2, classe 3, historique 4, don 5). */
  layer: Layer;
  grants: readonly ChoiceGrant[];
  /**
   * V3.1-117 : la fiche vient d'une classe (sous-classe) ; ses choix et ses
   * sorts se comptent au niveau de CETTE classe, pas au niveau de personnage.
   */
  classKey?: string;
  /**
   * V3.1-49 : d'où vient la fiche, pour ranger ses choix sous l'étape de
   * création qui les fait naître. Un don accordé par l'historique est en
   * couche 5 comme un don de classe : la couche ne suffit pas à le dire.
   */
  origin?: "species" | "class" | "background";
}

/** Un don qu'un choix `feat` peut désigner, avec ce qu'il accorde. */
export interface FeatChoiceData {
  key: string;
  label: string;
  /** Catégorie du don (`origin`, `general`…). Absente : il ne remplit aucun choix qui en exige une. */
  category?: string;
  grants: readonly ChoiceGrant[];
  modifiers: readonly DeclaredModifier[];
}

/** Ce que le moteur sait d'un sort pour valider un choix : son niveau et les listes de classe qui le portent. */
export interface SpellMeta {
  level: number;
  lists: readonly string[];
  /** École de magie (`evocation`…). Absente : un choix qui exige une école refuse le sort. */
  school?: string;
}

export interface ResolveChoicesInput {
  sources: readonly ChoiceSource[];
  choices: Readonly<Record<string, unknown>>;
  /** Réponses imposées par une autre fiche (historique Acolyte → liste du clerc). Elles priment sur la réponse stockée. */
  presets?: Readonly<Record<string, readonly string[]>>;
  characterLevel: number;
  /** Niveau de chaque classe, pour les fiches qui en viennent (`ChoiceSource.classKey`). Absent : leurs choix restent fermés. */
  classLevels?: Readonly<Record<string, number>>;
  /** Les dons qu'un choix `feat` peut désigner. Absent : aucun don choisi n'a d'effet. */
  feats?: Readonly<Record<string, FeatChoiceData>>;
  /**
   * Les sorts choisis, avec leur niveau et leurs listes. Fourni (serveur,
   * qui fait foi) : un sort hors de sa liste ou de son niveau est écarté.
   * Absent (aperçu dans le navigateur) : le sort choisi est pris tel quel.
   */
  spells?: Readonly<Record<string, SpellMeta>>;
  /**
   * V3.1-49 : les autres aptitudes du personnage (hors de ces choix). Une
   * expertise ne porte que sur une compétence qu'elles, ou un autre choix,
   * rendent maîtrisée. Absent : l'expertise choisie est prise telle quelle.
   */
  otherFeatures?: readonly ResolvedFeature[];
}

/** Un choix ouvert au personnage, répondu ou non. */
export interface OpenChoice {
  key: string;
  label: string;
  count: number;
  from: ChoiceFrom;
  refresh: "never" | "short_rest" | "long_rest";
  /** Les réponses retenues (valides, sans doublon, au plus `count`). */
  chosen: string[];
  /** La réponse est imposée par une autre fiche : rien à choisir. */
  preset: boolean;
  /** Clé de la fiche qui porte le choix. */
  sourceKey: string;
}

export interface ChosenGrant {
  key: string;
  /** Libellé de la fiche d'où vient la maîtrise, pour l'onglet Traits. */
  source: string;
}

export interface ResolvedChoices {
  open: OpenChoice[];
  /** Les effets des réponses, à verser dans `ruleset.features` et `build.featureKeys`. */
  features: ResolvedFeature[];
  tools: ChosenGrant[];
  languages: ChosenGrant[];
  /** Les compétences maîtrisées hors expertise (V3.1-49) : ce qu'une expertise peut viser. Vide si `otherFeatures` est absent. */
  proficientSkills: string[];
}

/** Libellé d'un texte localisé de fiche : français d'abord, puis anglais, puis le premier présent. */
export function localizedLabel(label: Readonly<Record<string, string>>, fallback: string): string {
  return label.fr ?? label.en ?? Object.values(label)[0] ?? fallback;
}

const KEY_PATTERN = /^[a-z0-9_-]+$/;

function asKeyList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v !== "");
}

/** Les compétences s'écrivent avec des tirets dans le SRD (« animal-handling ») et des soulignés sur la fiche. */
function skillKey(value: string): string | null {
  const key = value.replace(/-/g, "_");
  return (SKILLS as readonly string[]).includes(key) ? key : null;
}

interface Scope {
  /** Préfixe des clés des choix de cette liste. */
  prefix: string;
  source: ChoiceSource;
  /** Caractéristique d'incantation des sorts accordés dans ce sous-arbre. */
  ability?: Ability;
}

export function resolveChoices(input: ResolveChoicesInput): ResolvedChoices {
  const result: ResolvedChoices = { open: [], features: [], tools: [], languages: [], proficientSkills: [] };
  /** Les expertises, retenues seulement à la fin : la maîtrise qui les autorise peut venir d'un choix résolu après elles. */
  const expertises: { open: OpenChoice; values: string[]; count: number; options?: string[]; scope: Scope }[] = [];

  function answerOf(key: string): { values: string[]; preset: boolean } {
    const preset = input.presets?.[key];
    if (preset) return { values: [...preset], preset: true };
    return { values: asKeyList(input.choices[key]), preset: false };
  }

  function retain(values: string[], count: number, accept: (v: string) => boolean): string[] {
    const kept: string[] = [];
    for (const v of values) {
      if (kept.length >= count) break;
      if (!kept.includes(v) && accept(v)) kept.push(v);
    }
    return kept;
  }

  function spellAccepted(key: string, from: Extract<ChoiceFrom, { kind: "spell" }>): boolean {
    if (!KEY_PATTERN.test(key)) return false;
    if (!input.spells) return true;
    const meta = input.spells[key];
    if (!meta) return false;
    if (from.level !== undefined && meta.level !== from.level) return false;
    if (from.max_level !== undefined && meta.level > from.max_level) return false;
    if (from.school !== undefined && meta.school !== from.school) return false;
    if (from.list !== undefined && !meta.lists.includes(from.list)) return false;
    return from.lists === undefined || from.lists.some((l) => meta.lists.includes(l));
  }

  /** Niveau qui ouvre les choix d'une fiche : celui de sa classe, ou du personnage. */
  function levelOf(source: ChoiceSource): number {
    return source.classKey ? (input.classLevels?.[source.classKey] ?? 0) : input.characterLevel;
  }

  function featureSpells(
    spells: readonly { key: string; at_level?: number; always_prepared?: boolean; free_cast?: FreeCast }[],
    ability: Ability | undefined,
    classKey: string | undefined
  ): FeatureSpell[] {
    return spells.map((s) => ({
      key: s.key,
      atLevel: s.at_level ?? 1,
      ...(classKey ? { classKey } : {}),
      ...(ability ? { ability } : {}),
      alwaysPrepared: s.always_prepared === true,
      ...(s.free_cast ? { freeCast: s.free_cast } : {}),
    }));
  }

  /** Une réponse sans effet (caractéristique, type de dégâts, langue) ne produit pas d'aptitude vide. */
  function pushFeature(key: string, label: string, scope: Scope, modifiers: Modifier[], spells: FeatureSpell[], always = false) {
    if (!always && modifiers.length === 0 && spells.length === 0) return;
    result.features.push({ key, label, source: scope.source.key, modifiers, ...(spells.length > 0 ? { spells } : {}) });
  }

  /** La caractéristique d'incantation déclarée dans une liste de choix : elle vaut pour tout ce que la liste accorde, quel que soit l'ordre. */
  function spellcastingAbility(grants: readonly ChoiceGrant[], prefix: string, level: number): Ability | undefined {
    for (const grant of grants) {
      if (grant.from.kind !== "ability" || !grant.from.spellcasting) continue;
      if ((grant.at_level ?? 1) > level) continue;
      const allowed = grant.from.options ?? ABILITIES;
      const [value] = retain(answerOf(`${prefix}.${grant.id}`).values, 1, (v) => (allowed as readonly string[]).includes(v));
      return value as Ability | undefined;
    }
    return undefined;
  }

  function walk(grants: readonly ChoiceGrant[], scope: Scope) {
    const level = levelOf(scope.source);
    const classKey = scope.source.classKey;
    const ability = spellcastingAbility(grants, scope.prefix, level) ?? scope.ability;
    for (const grant of grants) {
      if ((grant.at_level ?? 1) > level) continue;
      const key = `${scope.prefix}.${grant.id}`;
      const count = grant.from.kind === "ability" || grant.from.kind === "option" || grant.from.kind === "feat" ? 1 : (grant.count ?? 1);
      const label = localizedLabel(grant.label, grant.id);
      const answer = answerOf(key);
      const open: OpenChoice = { key, label, count, from: grant.from, refresh: grant.refresh ?? "never", chosen: [], preset: answer.preset, sourceKey: scope.source.key };
      result.open.push(open);
      const here: Scope = { ...scope, ability };
      const from = grant.from;

      switch (from.kind) {
        case "skill": {
          if (from.expertise) {
            expertises.push({ open, values: answer.values, count, options: from.options, scope: here });
            break;
          }
          open.chosen = retain(answer.values, count, (v) => {
            const skill = skillKey(v);
            if (skill) return from.options ? from.options.some((o) => skillKey(o) === skill) : true;
            return from.tools === true && KEY_PATTERN.test(v);
          });
          const skills = open.chosen.map(skillKey).filter((s): s is string => s !== null);
          const modifiers: Modifier[] = skills.map((s) => ({ target: `skill.${s}`, op: "proficiency", source: scope.source.key, label: scope.source.label, layer: scope.source.layer }));
          pushFeature(`choice:${key}`, scope.source.label, here, modifiers, []);
          for (const v of open.chosen) if (!skillKey(v)) result.tools.push({ key: v, source: scope.source.label });
          break;
        }
        case "tool":
        case "language": {
          open.chosen = retain(answer.values, count, (v) => (from.options ? from.options.includes(v) : KEY_PATTERN.test(v)));
          const target = from.kind === "tool" ? result.tools : result.languages;
          for (const v of open.chosen) target.push({ key: v, source: scope.source.label });
          break;
        }
        case "damage_type": {
          open.chosen = retain(answer.values, count, (v) => (from.options ? from.options.includes(v) : KEY_PATTERN.test(v)));
          break;
        }
        case "ability": {
          const allowed = from.options ?? ABILITIES;
          open.chosen = retain(answer.values, count, (v) => (allowed as readonly string[]).includes(v));
          break;
        }
        case "spell": {
          open.chosen = retain(answer.values, count, (v) => spellAccepted(v, from));
          const spells = featureSpells(
            open.chosen.map((k) => ({ key: k, at_level: grant.at_level, always_prepared: from.always_prepared, free_cast: from.free_cast })),
            ability,
            classKey
          );
          pushFeature(`choice:${key}`, scope.source.label, here, [], spells);
          break;
        }
        case "option": {
          open.chosen = retain(answer.values, 1, (v) => from.options.some((o) => o.id === v));
          const option: ChoiceOption | undefined = from.options.find((o) => o.id === open.chosen[0]);
          if (!option) break;
          const optionLabel = `${scope.source.label} (${localizedLabel(option.label, option.id)})`;
          pushFeature(
            `choice:${key}`,
            optionLabel,
            here,
            resolveDeclaredModifiers(option.modifiers ?? [], scope.source.key, optionLabel, scope.source.layer),
            featureSpells(option.spells ?? [], spellcastingAbility(option.grants ?? [], `${key}.${option.id}`, level) ?? ability, classKey)
          );
          if (option.grants) walk(option.grants, { ...here, prefix: `${key}.${option.id}` });
          break;
        }
        case "feat": {
          open.chosen = retain(answer.values, 1, (v) => {
            const feat = input.feats?.[v];
            return feat !== undefined && (from.category === undefined || feat.category === from.category);
          });
          const feat = open.chosen[0] ? input.feats?.[open.chosen[0]] : undefined;
          if (!feat) break;
          // Un don vit en couche 5, quelle que soit la fiche qui l'accorde.
          const featSource: ChoiceSource = { key: `${key}.${feat.key}`, label: feat.label, layer: 5, grants: feat.grants };
          const featScope: Scope = { prefix: `${key}.${feat.key}`, source: featSource };
          // Un don choisi figure parmi les traits même sans effet chiffré (Vigilant).
          pushFeature(`choice:${key}`, feat.label, featScope, resolveDeclaredModifiers(feat.modifiers, featSource.key, feat.label, 5), [], true);
          walk(feat.grants, featScope);
          break;
        }
      }
    }
  }

  for (const source of input.sources) walk(source.grants, { prefix: source.key, source });

  const proficient = new Set<string>();
  for (const feature of [...(input.otherFeatures ?? []), ...result.features]) {
    for (const m of feature.modifiers) if (m.op === "proficiency" && m.target.startsWith("skill.")) proficient.add(m.target.slice(6));
  }
  if (input.otherFeatures) result.proficientSkills = SKILLS.filter((s) => proficient.has(s));
  for (const e of expertises) {
    e.open.chosen = retain(e.values, e.count, (v) => {
      const skill = skillKey(v);
      if (!skill) return false;
      if (e.options && !e.options.some((o) => skillKey(o) === skill)) return false;
      return !input.otherFeatures || proficient.has(skill);
    });
    const modifiers: Modifier[] = e.open.chosen.map((s) => ({ target: `skill.${skillKey(s)}`, op: "expertise", source: e.scope.source.key, label: e.scope.source.label, layer: e.scope.source.layer }));
    pushFeature(`choice:${e.open.key}`, e.scope.source.label, e.scope, modifiers, []);
  }
  return result;
}

/** Un choix de compétences ou de langues sous la forme qu'attendent les écrans existants (`RemainingChoice`). */
export interface SimpleChoiceView {
  id: string;
  label: string;
  count: number;
  options: string[];
  kind: "skill" | "language";
}

/**
 * Les choix de compétences et de langues de PREMIER niveau (V3.1-116) : ceux
 * que les écrans savaient déjà proposer (assistant, onglet Maîtrises), sous
 * la même clé qu'avant (`skillful.skills`). Les choix imbriqués (sous une
 * option ou un don choisi) attendent l'assistant de V3.1-118. Un choix qui
 * permet aussi un outil n'y figure pas : ces écrans ne connaissent pas les outils.
 */
export function simpleGrantChoices(sources: readonly ChoiceSource[], characterLevel: number, allLanguages: readonly string[]): SimpleChoiceView[] {
  const views: SimpleChoiceView[] = [];
  for (const source of sources) {
    for (const grant of source.grants) {
      if ((grant.at_level ?? 1) > characterLevel) continue;
      const from = grant.from;
      const base = { id: `${source.key}.${grant.id}`, label: `${source.label} — ${localizedLabel(grant.label, grant.id)}`, count: grant.count ?? 1 };
      if (from.kind === "skill" && !from.tools) {
        const options = (from.options ?? SKILLS).map(skillKey).filter((s): s is string => s !== null);
        views.push({ ...base, options, kind: "skill" });
      } else if (from.kind === "language") {
        views.push({ ...base, options: [...(from.options ?? allLanguages)], kind: "language" });
      }
    }
  }
  return views;
}
