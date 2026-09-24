import type { FormulaNode } from "../formula/ast";
import { parseFormula } from "../formula/parser";
import { formatFormulaNode } from "../formula/format";

/**
 * V2-N2 — Creer un sort maison.
 *
 * Construit la fiche a importer, dans la forme exacte que produit l'import
 * SRD (`spellBlocks`, scripts/ingest-srd.ts) : c'est elle que relisent la
 * fiche de regle, l'onglet Actions (`castSpell`) et l'assistant de creation.
 * Pure — l'ecriture vit dans `createHomebrewSpell` (src/server/services/rules.ts).
 *
 * Trois choix, tous pour rester dans cette forme :
 * - **Classes et niveau vont dans un `custom_table`** (`field`/`value`, meme
 *   forme brute que l'import) : c'est aujourd'hui la seule donnee que lit
 *   `SpellSelectionStep.tsx` pour proposer un sort a la creation de
 *   personnage (`parseSpellClasses`/`parseSpellLevel`). En faire des champs
 *   types du bloc `spell_casting` obligerait a changer ce point de lecture
 *   en meme temps — un autre ticket.
 * - **Sans effet chiffre, pas de bloc `effects`**, comme les quatre sorts
 *   sur cinq du SRD qui n'en ont pas. La fiche affiche alors le meme
 *   avertissement de bloc manquant qu'eux.
 * - **La montee en puissance suit l'axe du SRD** : niveau de personnage pour
 *   un tour de magie (palier de base 1), niveau d'emplacement sinon (palier
 *   de base = niveau du sort). Toujours une table, palier de base compris,
 *   jamais un pas constant a deviner.
 */

export const SPELL_SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"] as const;
export const SAVE_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const SPELL_DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
] as const;

export interface HomebrewSpellEffectInput {
  kind: "save" | "attack" | "none";
  ability: string;
  attackRange: "melee" | "ranged";
  formula: string;
  damageType: string;
  onSuccess: "none" | "half" | "other";
}

export interface HomebrewSpellInput {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: ("V" | "S" | "M")[];
  material: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  pageRef: string;
  /** `null` : section « Effet chiffre » laissee fermee. */
  effect: HomebrewSpellEffectInput | null;
  scaling: { level: number; formula: string }[];
  /** Cle de regle de chaque classe autorisee, et son nom pour la ligne brute. */
  classes: { key: string; name: string }[];
}

export interface HomebrewSpellEntry {
  name: string;
  entry_type: "spell";
  blocks: { block_type: "description" | "spell_casting" | "effects" | "scaling" | "custom_table"; display?: { label?: string; collapsed?: boolean }; data: unknown }[];
}

/** Une saisie refusee, avec un message lisible par l'auteur. */
export class HomebrewSpellError extends Error {}

function hasRef(node: FormulaNode): boolean {
  if (node.op === "ref") return true;
  return "args" in node ? node.args.some(hasRef) : false;
}

/**
 * Des et nombres seulement. Le parseur accepte aussi une reference nommee
 * (`mod`, `level`...) : « beaucoup » y serait lu comme une variable, et le
 * sort ne planterait qu'au premier lancement. Refuse ici, a la saisie.
 */
function parseDamageFormula(text: string, what: string): FormulaNode {
  let node: FormulaNode;
  try {
    node = parseFormula(text.trim());
  } catch {
    throw new HomebrewSpellError(`${what} : formule illisible (« ${text.trim()} »). Écris des dés et des nombres, par exemple 8d6 ou 2d8 + 4.`);
  }
  if (hasRef(node)) {
    throw new HomebrewSpellError(`${what} : seulement des dés et des nombres (« ${text.trim()} »), par exemple 8d6 ou 2d8 + 4.`);
  }
  return node;
}

export function buildHomebrewSpellEntry(input: HomebrewSpellInput): HomebrewSpellEntry {
  const blocks: HomebrewSpellEntry["blocks"] = [];

  const description = input.description.trim();
  const pageRef = input.pageRef.trim();
  if (description || pageRef) {
    blocks.push({
      block_type: "description",
      data: { segments: description ? [{ text: description }] : [], ...(pageRef ? { page_ref: pageRef } : {}) },
    });
  }

  const material = input.material.trim();
  blocks.push({
    block_type: "spell_casting",
    data: {
      level: input.level,
      school: input.school,
      casting_time: input.castingTime.trim(),
      range: input.range.trim(),
      components: input.components,
      ...(input.components.includes("M") && material ? { material } : {}),
      duration: input.duration.trim(),
      concentration: input.concentration,
      ritual: input.ritual,
    },
  });

  if (input.effect) {
    const formula = parseDamageFormula(input.effect.formula, "Formule de dégâts");
    blocks.push({
      block_type: "effects",
      data: {
        effects: [
          {
            id: "e1",
            damage_type: input.effect.damageType,
            formula,
            ...(input.effect.kind === "save" ? { save: { ability: input.effect.ability, effect_on_success: input.effect.onSuccess } } : {}),
            ...(input.effect.kind === "attack" ? { attack: { range: input.effect.attackRange } } : {}),
          },
        ],
      },
    });

    const rows = input.scaling.filter((row) => row.formula.trim().length > 0);
    if (rows.length > 0) {
      const cantrip = input.level === 0;
      const baseLevel = cantrip ? 1 : input.level;
      const table: Record<string, string> = { [String(baseLevel)]: formatFormulaNode(formula) };
      for (const row of [...rows].sort((a, b) => a.level - b.level)) {
        if (row.level <= baseLevel) {
          throw new HomebrewSpellError(
            `Montée en puissance : le palier ${row.level} n'est pas au-dessus du palier de base (${cantrip ? "niveau de personnage 1" : `emplacement de niveau ${baseLevel}`}).`
          );
        }
        table[String(row.level)] = formatFormulaNode(parseDamageFormula(row.formula, `Palier ${row.level}`));
      }
      blocks.push({
        block_type: "scaling",
        data: { axis: cantrip ? "character_level" : "slot_level", base: baseLevel, rule: null, table },
      });
    }
  }

  blocks.push({
    block_type: "custom_table",
    display: { label: "Classes et niveau", collapsed: true },
    data: {
      columns: ["field", "value"],
      rows: [
        { field: "level", value: String(input.level) },
        { field: "classes", value: JSON.stringify(input.classes.map((c) => ({ index: c.key, name: c.name }))) },
      ],
    },
  });

  return { name: input.name.trim(), entry_type: "spell", blocks };
}
