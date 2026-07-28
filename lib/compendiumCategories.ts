export type CompendiumCategory = {
  id: string;
  label: string;
  entryTypes: string[];
  color: string;
};

// "features" et "levels" (progression par classe/niveau) sont volontairement
// exclus : ce ne sont pas des entrees consultables une par une, elles
// serviront de donnees de reference au futur bloc personnage structure.
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
    id: "objets",
    label: "Objets",
    entryTypes: ["equipment", "magic-items", "equipment-categories"],
    color: "hsl(40, 90%, 55%)",
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

export function categoryForEntryType(entryType: string): CompendiumCategory | undefined {
  return COMPENDIUM_CATEGORIES.find((c) => c.entryTypes.includes(entryType));
}

export const ALL_COMPENDIUM_ENTRY_TYPES = COMPENDIUM_CATEGORIES.flatMap((c) => c.entryTypes);
