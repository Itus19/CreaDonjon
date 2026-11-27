import type { InventoryBlockData, InventoryItem } from "../schemas/blocks/inventory";

/**
 * V3.2-54 (retour de l'auteur, 27 novembre) — Un objet que la narration met
 * dans les mains d'un PNJ (« elle essuie une chope », « une dague à la
 * ceinture ») entre dans son inventaire. Le moteur décide : un objet connu des
 * règles devient une référence de règle (ses chiffres viennent des règles,
 * jamais de l'IA) ; un autre reste un objet en ligne, sans chiffre.
 */

/** Noms français courants → clé de règle du SRD (les objets que portent les PNJ, `npcGear.ts`). */
const RULE_BY_NAME: Record<string, string> = {
  dague: "dagger",
  couteau: "dagger",
  "epee courte": "shortsword",
  "epee longue": "longsword",
  epee: "longsword",
  lance: "spear",
  gourdin: "club",
  baton: "quarterstaff",
  masse: "mace",
  faucille: "sickle",
  "marteau leger": "light-hammer",
  bouclier: "shield",
  "chemise de mailles": "chain-shirt",
  "cotte de mailles": "chain-shirt",
  "armure de cuir": "leather-armor",
  arbalete: "light-crossbow",
  "arbalete legere": "light-crossbow",
  arc: "shortbow",
  "arc court": "shortbow",
  "arc long": "longbow",
  hachette: "handaxe",
  "hache d'armes": "battleaxe",
  rapiere: "rapier",
  cimeterre: "scimitar",
};

const ARTICLES = /^(?:une?|la|le|les|l'|des|du|de la|sa|son|ses)\s*/u;

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(ARTICLES, "")
    .trim();
}

export function itemFromNarration(narrated: { name: string; hidden: boolean }, inventory: InventoryBlockData): InventoryItem | null {
  const label = narrated.name.trim().replace(/\s+/g, " ");
  if (label === "" || label.length > 80) return null;
  const key = normalize(label);
  const ruleKey = RULE_BY_NAME[key];

  const already = inventory.items.some((item) => ("ref" in item ? item.ref.kind === "rule" && item.ref.key === ruleKey : normalize(item.label) === key));
  if (already) return null;

  const used = new Set(inventory.items.map((i) => i.id));
  let n = 0;
  while (used.has(`recit-${n}`)) n++;
  const common = { id: `recit-${n}`, qty: 1, equipped: true, ...(narrated.hidden ? { concealed: true } : {}) };
  if (ruleKey) return { ...common, ref: { kind: "rule", key: ruleKey } };
  const display = label.replace(ARTICLES, "");
  return { ...common, label: display.charAt(0).toUpperCase() + display.slice(1) };
}
