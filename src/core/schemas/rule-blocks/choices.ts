import { z } from "zod";
import { ABILITIES, type Ability } from "../../rules/abilities";
import { zLocalized, zModifier } from "./primitives";

/**
 * Le choix accordé (V3.1-116, ADR 0046) : un seul mécanisme pour tout ce
 * qu'une fiche de règles laisse choisir au joueur — compétence, langue,
 * outil, don, sort, caractéristique, type de dégâts, ou une OPTION nommée
 * qui porte ses propres effets (lignage, legs, ascendance, liste de sorts).
 *
 * Porté par le bloc `choices` d'une fiche (trait d'espèce, don, historique,
 * aptitude). La réponse vit dans `character.choices[<clé qualifiée>]`, un
 * tableau de clés ; la résolution est `src/core/rules/choices.ts`.
 */

const zAbility = z.enum(ABILITIES as unknown as [Ability, ...Ability[]]);

/** Identifiant d'un choix ou d'une option : il entre dans la clé stockée sur le personnage, il ne change donc jamais. */
const zChoiceId = z.string().regex(/^[a-z0-9_-]+$/, "Identifiant en minuscules, chiffres, tirets ou soulignés.");

/** Lancer un sort sans emplacement : un nombre d'usages, ou autant que le bonus de maîtrise. */
export const zFreeCast = z.object({
  uses: z.union([z.number().int().positive(), z.literal("proficiency")]),
  refresh: z.enum(["short_rest", "long_rest"]),
});
export type FreeCast = z.infer<typeof zFreeCast>;

/** Un sort qu'une option accorde d'office, à partir d'un niveau de personnage (lignage : niveaux 1, 3, 5). */
export const zGrantedSpell = z.object({
  key: z.string().min(1),
  /** Niveau de personnage où le sort est appris. Absent : 1. */
  at_level: z.number().int().min(1).max(20).optional(),
  always_prepared: z.boolean().optional(),
  free_cast: zFreeCast.optional(),
});
export type GrantedSpellData = z.infer<typeof zGrantedSpell>;

export type ChoiceFrom =
  /**
   * `tools` : un outil peut remplacer une compétence (Doué : « trois compétences ou outils »).
   * `expertise` (V3.1-49) : le choix porte sur des compétences DÉJÀ maîtrisées et
   * leur donne l'expertise (Roublard, Barde).
   */
  | { kind: "skill"; options?: string[]; tools?: boolean; expertise?: boolean }
  | { kind: "language"; options?: string[] }
  | { kind: "tool"; options?: string[] }
  /** `category` : la catégorie du don (`origin`, `general`, `fighting-style`, `epic-boon`). Absente : tout don. */
  | { kind: "feat"; category?: string }
  /**
   * Un sort. Filtres facultatifs : une liste (`list`) ou plusieurs (`lists`),
   * un niveau exact (`level`, 0 : sort mineur) ou maximal (`max_level`), une
   * école (`school`). Découvertes magiques : trois listes ; Savant en
   * évocation : magicien, évocation, niveau 2 au plus.
   */
  | {
      kind: "spell";
      list?: string;
      lists?: string[];
      level?: number;
      max_level?: number;
      school?: string;
      always_prepared?: boolean;
      free_cast?: FreeCast;
    }
  /** `spellcasting` : cette caractéristique sert aux sorts accordés par la même fiche, ou par l'option qui la porte. */
  | { kind: "ability"; options?: Ability[]; spellcasting?: boolean }
  | { kind: "damage_type"; options?: string[] }
  | { kind: "option"; options: ChoiceOption[] };

export interface ChoiceOption {
  id: string;
  label: Record<string, string>;
  modifiers?: z.infer<typeof zModifier>[];
  spells?: GrantedSpellData[];
  /** Les choix que cette option ouvre à son tour (Initié à la magie : la liste choisie ouvre ses sorts). */
  grants?: ChoiceGrant[];
}

export interface ChoiceGrant {
  id: string;
  label: Record<string, string>;
  /** Nombre de valeurs à choisir. Absent : 1. */
  count?: number;
  /** Niveau de personnage à partir duquel le choix s'ouvre. Absent : 1. */
  at_level?: number;
  /** Le choix se rouvre au repos (Cercle de la Terre). Absent : jamais. */
  refresh?: "never" | "short_rest" | "long_rest";
  from: ChoiceFrom;
}

export const zChoiceOption: z.ZodType<ChoiceOption> = z.lazy(() =>
  z.object({
    id: zChoiceId,
    label: zLocalized,
    modifiers: z.array(zModifier).optional(),
    spells: z.array(zGrantedSpell).optional(),
    grants: z.array(zChoiceGrant).optional(),
  })
);

const zKeyList = z.array(z.string().min(1)).min(1).optional();

export const zChoiceFrom: z.ZodType<ChoiceFrom> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("skill"), options: zKeyList, tools: z.boolean().optional(), expertise: z.boolean().optional() }),
    z.object({ kind: z.literal("language"), options: zKeyList }),
    z.object({ kind: z.literal("tool"), options: zKeyList }),
    z.object({ kind: z.literal("feat"), category: z.string().min(1).optional() }),
    z.object({
      kind: z.literal("spell"),
      list: z.string().min(1).optional(),
      lists: z.array(z.string().min(1)).min(1).optional(),
      level: z.number().int().min(0).max(9).optional(),
      max_level: z.number().int().min(0).max(9).optional(),
      school: z.string().min(1).optional(),
      always_prepared: z.boolean().optional(),
      free_cast: zFreeCast.optional(),
    }),
    z.object({ kind: z.literal("ability"), options: z.array(zAbility).min(1).optional(), spellcasting: z.boolean().optional() }),
    z.object({ kind: z.literal("damage_type"), options: zKeyList }),
    z.object({
      kind: z.literal("option"),
      options: z
        .array(zChoiceOption)
        .min(1)
        .refine((options) => new Set(options.map((o) => o.id)).size === options.length, { message: "Deux options portent le même identifiant." }),
    }),
  ])
);

export const zChoiceGrant: z.ZodType<ChoiceGrant> = z.lazy(() =>
  z.object({
    id: zChoiceId,
    label: zLocalized,
    count: z.number().int().min(1).max(20).optional(),
    at_level: z.number().int().min(1).max(20).optional(),
    refresh: z.enum(["never", "short_rest", "long_rest"]).optional(),
    from: zChoiceFrom,
  })
);

/**
 * Le bloc `choices` d'une fiche de règles. `presets` : des réponses imposées
 * par cette fiche à un choix d'une AUTRE fiche qu'elle accorde (l'historique
 * Acolyte impose la liste du clerc à son Initié à la magie). Clé : la clé
 * qualifiée du choix, telle qu'elle serait stockée sur le personnage.
 */
export const zChoicesBlockData = z
  .object({
    grants: z.array(zChoiceGrant),
    presets: z.record(z.string().min(1), z.array(z.string().min(1)).min(1)).optional(),
  })
  .refine((d) => new Set(d.grants.map((g) => g.id)).size === d.grants.length, { message: "Deux choix portent le même identifiant." });
export type ChoicesBlockData = z.infer<typeof zChoicesBlockData>;
