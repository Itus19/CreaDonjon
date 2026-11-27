import type { InventoryBlockData, InventoryItem } from "../schemas/blocks/inventory";

/**
 * V3.2-54 (retour de l'auteur, 27 novembre) — Un objet ordinaire que la
 * narration montre dans les mains d'un PNJ (« elle essuie une chope ») entre
 * dans son inventaire, visible, puisque le personnage vient de le voir.
 *
 * Second retour, même jour : la fiche et l'inventaire sont tirés UNE fois, à
 * la création de la page ; ensuite rien d'important ne s'invente. Le moteur
 * refuse donc une arme ou une armure absente de la fiche (la fiche
 * l'emporte, ADR 0104), et n'accepte jamais d'objet caché du récit : une
 * fouille ne doit trouver que ce que le tirage a mis.
 */

/** Noms français des armes et armures courantes (clés du SRD) : jamais ajoutées par le récit. */
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

export function itemFromNarration(narrated: { name: string }, inventory: InventoryBlockData): InventoryItem | null {
  const label = narrated.name.trim().replace(/\s+/g, " ");
  if (label === "" || label.length > 80) return null;
  const key = normalize(label);
  // Une arme ou une armure : seule la fiche tirée à la création en donne.
  if (RULE_BY_NAME[key]) return null;

  const already = inventory.items.some((item) => !("ref" in item) && normalize(item.label) === key);
  if (already) return null;

  const used = new Set(inventory.items.map((i) => i.id));
  let n = 0;
  while (used.has(`recit-${n}`)) n++;
  const display = label.replace(ARTICLES, "");
  return { id: `recit-${n}`, qty: 1, equipped: true, label: display.charAt(0).toUpperCase() + display.slice(1) };
}
