export type CompendiumCategory = {
  id: string;
  label: string;
  entryTypes: string[];
  color: string;
  // Pour les categories qui partagent les memes entry_type (armes/armures/
  // outils/objets partagent tous "equipment"+"magic-items") : filtre
  // supplementaire applique cote client sur structured_data pour repartir
  // les entrees entre les quatre. Les deux rulesets ne rangent pas la
  // categorie au meme endroit : "equipment_category" (objet, 2014 et
  // magic-items 2024) ou "equipment_categories" (tableau, equipment 2024).
  objectFilter?: (structuredData: Record<string, unknown>) => boolean;
};

function equipmentCategoryNames(data: Record<string, unknown>): string[] {
  const single = data.equipment_category as { name?: string } | undefined;
  const multi = data.equipment_categories as { name?: string }[] | undefined;
  const names: string[] = [];
  if (single?.name) names.push(single.name);
  if (Array.isArray(multi)) {
    names.push(...multi.map((c) => c?.name).filter((n): n is string => !!n));
  }
  return names;
}

function isWeapon(data: Record<string, unknown>) {
  return equipmentCategoryNames(data).some((n) => /weapon/i.test(n) || n === "Ammunition");
}
function isArmor(data: Record<string, unknown>) {
  return equipmentCategoryNames(data).some((n) => /armor|shield/i.test(n));
}
function isTool(data: Record<string, unknown>) {
  return equipmentCategoryNames(data).some((n) => /tool|gaming set|musical instrument/i.test(n));
}

// "features" et "levels" (progression par classe/niveau) et
// "equipment-categories" (pages d'index listant quels objets appartiennent
// a une categorie, pas des objets en soi) sont volontairement exclus : ce
// ne sont pas des entrees consultables une par une.
export const COMPENDIUM_CATEGORIES: CompendiumCategory[] = [
  { id: "sorts", label: "Sorts", entryTypes: ["spells"], color: "hsl(270, 65%, 60%)" },
  { id: "classes", label: "Classes", entryTypes: ["classes", "subclasses"], color: "hsl(210, 70%, 55%)" },
  {
    id: "especes",
    label: "Espèces",
    entryTypes: ["races", "subraces", "species", "subspecies"],
    color: "hsl(150, 55%, 45%)",
  },
  { id: "origines", label: "Origines", entryTypes: ["backgrounds"], color: "hsl(35, 70%, 50%)" },
  { id: "monstres", label: "Monstres", entryTypes: ["monsters"], color: "hsl(0, 65%, 55%)" },
  {
    id: "armes",
    label: "Armes",
    entryTypes: ["equipment", "magic-items"],
    color: "hsl(5, 70%, 50%)",
    objectFilter: isWeapon,
  },
  {
    id: "armures",
    label: "Armures",
    entryTypes: ["equipment", "magic-items"],
    color: "hsl(215, 55%, 50%)",
    objectFilter: isArmor,
  },
  {
    id: "outils",
    label: "Outils",
    entryTypes: ["equipment", "magic-items"],
    color: "hsl(30, 60%, 48%)",
    objectFilter: isTool,
  },
  {
    id: "objets",
    label: "Objets",
    entryTypes: ["equipment", "magic-items"],
    color: "hsl(40, 90%, 55%)",
    objectFilter: (d) => !isWeapon(d) && !isArmor(d) && !isTool(d),
  },
  { id: "dons", label: "Dons", entryTypes: ["feats"], color: "hsl(20, 75%, 55%)" },
  { id: "traits", label: "Traits", entryTypes: ["traits"], color: "hsl(160, 50%, 50%)" },
  { id: "competences", label: "Compétences", entryTypes: ["skills"], color: "hsl(195, 65%, 55%)" },
  {
    id: "reference",
    label: "Référence",
    entryTypes: [
      "conditions",
      "damage-types",
      "weapon-properties",
      "weapon-mastery-properties",
      "languages",
      "alignments",
      "magic-schools",
      "poisons",
      "ability-scores",
      "proficiencies",
      "rule-sections",
      "rules",
    ],
    color: "hsl(220, 15%, 55%)",
  },
];

// Utilise pour retrouver la categorie d'une entree deja ouverte (badge de
// la fenetre de detail) : quand plusieurs categories partagent le meme
// entry_type, structuredData permet de trancher via objectFilter.
export function categoryForEntry(
  entryType: string,
  structuredData?: Record<string, unknown>,
): CompendiumCategory | undefined {
  const candidates = COMPENDIUM_CATEGORIES.filter((c) => c.entryTypes.includes(entryType));
  if (candidates.length <= 1) return candidates[0];
  if (!structuredData) return candidates[0];
  return candidates.find((c) => c.objectFilter?.(structuredData)) ?? candidates[candidates.length - 1];
}
