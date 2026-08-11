import type { InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";

/** `label` non vide : `zInventoryItem` (variante en ligne) exige `z.string().min(1)` — un objet créé avec un libellé vide passait l'affichage local mais échouait silencieusement à l'enregistrement (400), ce qui donnait l'impression que « Ajouter un objet » ne faisait rien. */
export function newItem(): InventoryItem {
  return { id: crypto.randomUUID(), label: "Nouvel objet", qty: 1 };
}

// Verifie la valeur, pas seulement la presence de la cle : apres un
// changement de nature (setNature), l'ancienne cle peut rester presente
// avec une valeur `undefined` le temps d'un rendu, avant d'etre elaguee
// par Zod a l'enregistrement. Partage entre `InventoryBlockEditor`,
// `PlayableCharacterSheet` et `InventoryPanel` (V1-B4, V1-C18) — une seule
// definition des helpers d'objet d'inventaire, jamais une copie par ecran.
export function itemRef(item: InventoryItem): BlockReference | null {
  return (item as { ref?: BlockReference }).ref ?? null;
}

export function itemLabel(item: InventoryItem): string {
  const label = (item as { label?: string }).label;
  if (label) return label;
  const ref = itemRef(item);
  if (ref) return ref.kind === "rule" ? ref.key : ref.id;
  return "";
}
