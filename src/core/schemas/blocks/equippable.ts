import { z } from "zod";
import { zModifier } from "../rule-blocks/primitives";
import { zFreeCast } from "../rule-blocks/choices";
import { RULE_RECHARGES } from "../rule-blocks/playable";

/**
 * AG-19 (ADR 0107) — bloc « Objet équipable » d'une fiche du wiki (un
 * artéfact) : ce que l'objet fait à la fiche de qui le porte. Les briques sont
 * celles des dons (`zModifier`, sort accordé avec lancement gratuit) ; seule
 * l'action à charges est nouvelle. L'histoire de l'objet reste dans ses autres
 * blocs : le wiki ne devient pas un second moteur de règles.
 */
const zSortAccorde = z.object({
  /** Clé d'un sort du ruleset du monde. */
  key: z.string().trim().min(1).max(120),
  /** Caractéristique d'incantation de l'objet ; absente : celle de la classe du porteur. */
  ability: z.enum(["str", "dex", "con", "int", "wis", "cha"]).optional(),
  free_cast: zFreeCast.optional(),
});

const zActionACharges = z.object({
  /** Stable : le compteur de charges de la fiche se range sous cette clé. */
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(2000).optional(),
  charges: z.number().int().min(1).max(50),
  recharge: z.enum(RULE_RECHARGES),
});

export const zEquippableBlockData = z
  .object({
    __v: z.literal(1),
    /** « Harmonisation requise » : rien ne compte tant que le porteur n'est pas lié à l'objet. */
    requires_attunement: z.boolean(),
    /** « Seulement équipé » : rien ne compte dans le sac ; décoché, l'objet agit dès qu'on le porte sur soi. */
    only_equipped: z.boolean(),
    modifiers: z.array(zModifier).max(30),
    spells: z.array(zSortAccorde).max(20),
    actions: z.array(zActionACharges).max(10),
  })
  .refine((d) => new Set(d.actions.map((a) => a.id)).size === d.actions.length, { message: "Deux actions de même identifiant." });
export type EquippableBlockData = z.infer<typeof zEquippableBlockData>;

export const DEFAULT_EQUIPPABLE_BLOCK_DATA: EquippableBlockData = {
  __v: 1,
  requires_attunement: false,
  only_equipped: true,
  modifiers: [],
  spells: [],
  actions: [],
};
