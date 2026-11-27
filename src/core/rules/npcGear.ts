import { SeededRng } from "../dice/rng";
import { deriveSeed } from "../worldgen/seed";
import type { InventoryBlockData, InventoryItem } from "../schemas/blocks/inventory";
import type { SettlementWealth } from "../schemas/blocks/settlement";

/**
 * V3.2-48 (ADR 0118) — L'équipement probable et la bourse d'un PNJ, tirés à
 * graine fixe d'après son archétype de vie et la richesse de sa ville.
 *
 * Chaque objet dit s'il se voit : porté et visible (une lance, une cotte, un
 * tablier) ou porté mais caché (`concealed` : un couteau sous le tablier,
 * une bourse). Ce qui se voit se découvre dès que le PNJ est vu ; le reste
 * attend un indice (V3.2-50). Les armes et armures sont des références de
 * règle : poids, dégâts et CA viennent des règles, jamais d'ici.
 */

interface GearEntry {
  /** Clé d'une fiche d'équipement du SRD, ou libellé d'un objet sans règle. */
  item: { rule: string } | { label: string };
  /** Probabilité de le porter, de 0 à 1. */
  chance: number;
  /** Porté mais caché : ne se voit pas sans indice. */
  concealed?: boolean;
}

const always = (item: GearEntry["item"], concealed?: boolean): GearEntry => ({ item, chance: 1, ...(concealed ? { concealed } : {}) });
const maybe = (item: GearEntry["item"], chance: number, concealed?: boolean): GearEntry => ({ item, chance, ...(concealed ? { concealed } : {}) });
const rule = (key: string) => ({ rule: key });
const label = (text: string) => ({ label: text });

const ROTURIER: readonly GearEntry[] = [always(label("Vêtements ordinaires")), maybe(rule("dagger"), 0.3, true)];

export const NPC_GEAR_BY_ARCHETYPE: Readonly<Record<string, readonly GearEntry[]>> = {
  personnel_de_lieu: [always(label("Vêtements ordinaires")), always(label("Tablier")), maybe(label("Torchon"), 0.6), maybe(rule("dagger"), 0.4, true)],
  artisan: [always(label("Vêtements de travail")), always(label("Tablier de cuir")), maybe(rule("light-hammer"), 0.6), maybe(rule("smiths-tools"), 0.5)],
  journalier: [always(label("Vêtements usés")), maybe(rule("sickle"), 0.4), maybe(rule("club"), 0.3)],
  marchand_etabli: [always(label("Vêtements soignés")), maybe(rule("ink"), 0.5), maybe(label("Livre de comptes"), 0.6), maybe(rule("dagger"), 0.5, true)],
  garde: [always(rule("spear")), always(rule("chain-shirt")), maybe(rule("shield"), 0.6), always(label("Tabard aux couleurs de la ville"))],
  pretre: [always(label("Robe de prêtre")), always(rule("emblem")), maybe(rule("mace"), 0.3), maybe(rule("book"), 0.4)],
  pilier_de_bar: [always(label("Vêtements fatigués")), maybe(rule("club"), 0.5), maybe(rule("dagger"), 0.4, true)],
  joueur: [always(label("Vêtements voyants")), always(label("Jeu de cartes"), true), maybe(rule("dagger"), 0.5, true)],
  enfant: [always(label("Vêtements rapiécés")), maybe(label("Fronde"), 0.3)],
  vieillard: [always(label("Vêtements chauds")), maybe(rule("quarterstaff"), 0.6)],
  voyageur: [always(rule("clothes-travelers")), always(rule("backpack")), maybe(rule("shortsword"), 0.5), maybe(rule("waterskin"), 0.7)],
  marchand_ambulant: [always(rule("clothes-travelers")), always(rule("backpack")), maybe(rule("dagger"), 0.6, true)],
  messager: [always(rule("clothes-travelers")), always(label("Sacoche scellée")), maybe(rule("shortsword"), 0.3)],
  pelerin: [always(rule("clothes-travelers")), always(rule("quarterstaff")), always(rule("amulet"))],
  malfrat: [always(label("Vêtements sombres")), always(rule("leather-armor")), always(rule("shortsword")), always(rule("dagger"), true)],
  noble: [always(rule("clothes-fine")), maybe(rule("perfume"), 0.5), maybe(rule("longsword"), 0.4), maybe(label("Chevalière"), 0.7)],
};

/** Ce qu'un PNJ porte sur lui, en cuivre : [min, max] avant la richesse de la ville. */
const PURSE_CP: Readonly<Record<string, readonly [number, number]>> = {
  noble: [2000, 6000],
  marchand_etabli: [300, 1500],
  marchand_ambulant: [100, 600],
  joueur: [50, 400],
  voyageur: [50, 300],
  artisan: [50, 300],
  garde: [30, 200],
  malfrat: [20, 200],
  personnel_de_lieu: [20, 150],
  pretre: [20, 150],
  messager: [20, 100],
  vieillard: [10, 100],
  pilier_de_bar: [5, 80],
  journalier: [5, 60],
  pelerin: [5, 50],
  enfant: [0, 10],
};
const DEFAULT_PURSE: readonly [number, number] = [10, 100];

const WEALTH_FACTOR: Readonly<Record<SettlementWealth, number>> = { modeste: 0.5, correcte: 1, reputee: 2 };

export interface NpcGearParams {
  archetype?: string;
  seed: number;
  wealth: SettlementWealth;
}

export function purseInCp(params: NpcGearParams): number {
  const [min, max] = (params.archetype !== undefined ? PURSE_CP[params.archetype] : undefined) ?? DEFAULT_PURSE;
  const rng = new SeededRng(deriveSeed(params.seed, "bourse"));
  const base = min + rng.nextInt(max - min + 1);
  return Math.round(base * WEALTH_FACTOR[params.wealth]);
}

export function npcGear(params: NpcGearParams): InventoryBlockData {
  const entries = (params.archetype !== undefined ? NPC_GEAR_BY_ARCHETYPE[params.archetype] : undefined) ?? ROTURIER;
  const rng = new SeededRng(deriveSeed(params.seed, "equipement"));

  const items: InventoryItem[] = [];
  entries.forEach((entry, index) => {
    // Un tirage par ligne, même pour une ligne certaine : ajouter une ligne ne décale pas les suivantes.
    const roll = rng.nextInt(1000) / 1000;
    if (roll >= entry.chance) return;
    const common = { id: `pnj-${index}`, qty: 1, equipped: true, ...(entry.concealed ? { concealed: true } : {}) };
    items.push("rule" in entry.item ? { ...common, ref: { kind: "rule", key: entry.item.rule } } : { ...common, label: entry.item.label });
  });

  const cp = purseInCp(params);
  return {
    __v: 1,
    items,
    containers: [],
    currency: { pp: 0, gp: Math.floor(cp / 100), ep: 0, sp: Math.floor((cp % 100) / 10), cp: cp % 10 },
  };
}
