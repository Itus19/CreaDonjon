import { z } from "zod";
import { zAbility, zAbilityScores } from "./abilities";

const zStatblockEntry = z.object({ name: z.string().min(1), text: z.string() });

/**
 * Bloc `statblock` (specs/wiki-blocs.md §4.1, §5) : une creature ou un PNJ
 * SANS build. Personne ne construira un gobelin niveau par niveau — les
 * valeurs sont plates, saisies directement, jamais derivees. La spec ne
 * fige pas de forme JSON exacte pour ce bloc (contrairement a `character`/
 * `inventory`/`spellcasting`/`resources`) ; la forme ci-dessous suit le
 * canevas standard d'une fiche de creature 5e, volontairement minimale.
 */
export const zStatblockBlockData = z.object({
  __v: z.literal(1),
  size: z.string(),
  creature_type: z.string(),
  alignment: z.string().optional(),
  ac: z.object({ value: z.number().int(), source: z.string().optional() }),
  hp: z.object({ value: z.number().int(), hit_dice: z.string().optional() }),
  // Texte libre plutot qu'un objet structure : les vitesses multiples
  // ("9 m, vol 18 m, nage 9 m") ne se pretent pas a un schema rigide.
  speed: z.string(),
  abilities: zAbilityScores,
  // partialRecord, pas record : seules les caracteristiques maitrisees sont
  // presentes, jamais les six (record exigerait une cle par valeur de l'enum).
  saving_throws: z.partialRecord(zAbility, z.number()).optional(),
  skills: z.record(z.string(), z.number()).optional(),
  senses: z.string().optional(),
  languages: z.string().optional(),
  challenge_rating: z.string().optional(),
  traits: z.array(zStatblockEntry),
  actions: z.array(zStatblockEntry),
  reactions: z.array(zStatblockEntry),
  legendary_actions: z.array(zStatblockEntry),
});
export type StatblockBlockData = z.infer<typeof zStatblockBlockData>;
