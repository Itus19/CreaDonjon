import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { ArmorData, ItemCost, WeaponData } from "@/src/core/rules/srdMapping";
import { COIN_VALUE_CP, depositCoins, spendCoins, type CoinType } from "@/src/core/rules/currency";

/**
 * V3.1-53 — L'Équipement de la création : gestes purs sur l'inventaire.
 * La CA et l'attaque ne se calculent jamais ici : elles viennent du moteur
 * (`characterSheet`, règle 16) une fois l'objet porté.
 */

/** Les trois tuiles : Armure, Main principale, Main secondaire (le bouclier). */
export type Emplacement = "armor" | "main" | "shield";

export function emplacementDe(armor: ArmorData | null, weapon: WeaponData | null): Emplacement | null {
  if (armor) return armor.category === "Shield" ? "shield" : "armor";
  if (weapon) return "main";
  return null;
}

/**
 * La bande d'équipement : allumer un objet éteint celui qui occupait son
 * emplacement (il revient au sac) ; éteindre le range. Un objet qui ne se
 * porte pas ne change rien.
 */
export function basculerPort(items: readonly InventoryItem[], index: number, emplacements: readonly (Emplacement | null)[]): InventoryItem[] {
  const cible = items[index];
  const emplacement = emplacements[index];
  if (!cible || !emplacement) return [...items];
  const allumer = cible.equipped !== true;
  return items.map((item, i) => {
    if (i === index) return { ...item, equipped: allumer };
    if (allumer && emplacements[i] === emplacement && item.equipped) return { ...item, equipped: false };
    return item;
  });
}

function enCuivre(cost: ItemCost): number | null {
  const valeur = COIN_VALUE_CP[cost.unit as CoinType];
  return valeur === undefined ? null : Math.round(cost.quantity * valeur);
}

/** Acheter : la bourse paie (monnaie rendue par `spendCoins`) ; `null` si elle ne suffit pas, l'inventaire ne change pas. */
export function acheter(inventaire: InventoryBlockData, item: InventoryItem, cost: ItemCost): InventoryBlockData | null {
  const prix = enCuivre(cost);
  if (prix === null) return null;
  const currency = spendCoins(inventaire.currency, "cp", prix);
  if (!currency) return null;
  return { ...inventaire, items: [...inventaire.items, item], currency };
}

/**
 * Rendre (création, `ratio` 1 : remboursé en entier) ou vendre (en jeu, le
 * `sell_ratio` du ruleset) : un exemplaire quitte l'inventaire, la bourse
 * reçoit la part du prix, arrondie au cuivre inférieur. Sans prix connu, rien
 * n'est remboursé.
 */
export function rendre(inventaire: InventoryBlockData, index: number, cost: ItemCost | null, ratio: number): InventoryBlockData {
  const item = inventaire.items[index];
  if (!item) return inventaire;
  const items = item.qty > 1 ? inventaire.items.map((it, i) => (i === index ? { ...it, qty: it.qty - 1 } : it)) : inventaire.items.filter((_, i) => i !== index);
  const prix = cost ? enCuivre(cost) : null;
  const rembourse = prix === null ? 0 : Math.floor(prix * ratio);
  return { ...inventaire, items, currency: rembourse > 0 ? depositCoins(inventaire.currency, "cp", rembourse) : inventaire.currency };
}

function plat(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** La boutique cherchable : chaque mot de la requête doit apparaître dans le texte de l'objet (nom, type, propriétés), sans accents ni casse. */
export function filtrerBoutique<T extends { texte: string }>(objets: readonly T[], requete: string): T[] {
  const mots = plat(requete).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return [...objets];
  return objets.filter((o) => {
    const texte = plat(o.texte);
    return mots.every((m) => texte.includes(m));
  });
}
