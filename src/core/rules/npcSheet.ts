import { SeededRng } from "../dice/rng";
import { deriveSeed } from "../worldgen/seed";
import type { StatblockBlockData } from "../schemas/blocks/statblock";
import type { BlockAbility } from "../schemas/blocks/abilities";

/**
 * V3.2-47 (ADR 0118) — La fiche allégée d'un PNJ sans classe.
 *
 * Le moteur ne l'invente pas : il part d'une des vingt fiches de PNJ du SRD
 * 2024 (Roturier, Garde, Gros-bras…), choisie d'après l'archétype de vie du
 * PNJ (ADR 0115), et l'ajuste un peu, à graine fixe. Même PNJ, même graine,
 * même fiche : rien de tiré n'a besoin d'être retenu ailleurs que dans le
 * bloc lui-même. Les valeurs du bloc `statblock` sont plates par conception
 * (SCHEMA §7) : ce ne sont pas des valeurs dérivées au sens de la règle 16.
 */

/** Les clés des fiches de PNJ humanoïdes du SRD 2024 (`data/srd/srd-2024.json`), vampire familier exclu. */
export const NPC_SHEET_KEYS = [
  "commoner",
  "noble",
  "acolyte",
  "guard",
  "bandit",
  "tough",
  "scout",
  "spy",
  "bandit-captain",
  "berserker",
  "knight",
  "veteran",
  "gladiator",
  "assassin",
  "cultist",
  "cult-fanatic",
  "priest",
  "druid",
  "mage",
  "archmage",
] as const;
export type NpcSheetKey = (typeof NPC_SHEET_KEYS)[number];

/**
 * Archétype de vie → fiche de départ. Les métiers sans fiche propre
 * (marchande, servante, enfant) partent du Roturier : leurs différences sont
 * dans les ajustements, l'équipement et la bourse (V3.2-48), pas dans une
 * fiche inventée.
 */
export const NPC_SHEET_BY_ARCHETYPE: Readonly<Record<string, NpcSheetKey>> = {
  personnel_de_lieu: "commoner",
  artisan: "commoner",
  journalier: "commoner",
  marchand_etabli: "commoner",
  garde: "guard",
  pretre: "acolyte",
  pilier_de_bar: "tough",
  joueur: "commoner",
  enfant: "commoner",
  vieillard: "commoner",
  voyageur: "scout",
  marchand_ambulant: "commoner",
  messager: "scout",
  pelerin: "commoner",
  malfrat: "bandit",
  noble: "noble",
};

const DEFAULT_SHEET: NpcSheetKey = "commoner";

/** La fiche de départ ; `fallback` dit qu'aucune n'était prévue pour cet archétype, pour que l'appelant puisse le signaler. */
export function npcSheetKey(archetype: string | undefined): { key: NpcSheetKey; fallback: boolean } {
  const key = archetype !== undefined ? NPC_SHEET_BY_ARCHETYPE[archetype] : undefined;
  return key ? { key, fallback: false } : { key: DEFAULT_SHEET, fallback: true };
}

/**
 * Ce que le métier change, en points de caractéristique. Petits écarts
 * seulement : une forgeronne reste une roturière, elle porte plus lourd.
 */
const ARCHETYPE_DELTAS: Readonly<Record<string, Partial<Record<BlockAbility, number>>>> = {
  artisan: { str: 2 },
  journalier: { str: 2, con: 1 },
  marchand_etabli: { cha: 2, int: 1 },
  marchand_ambulant: { cha: 2, con: 1 },
  personnel_de_lieu: { cha: 1, con: 1 },
  joueur: { cha: 1, dex: 1 },
  enfant: { str: -4, con: -2, dex: 1 },
  vieillard: { str: -2, con: -2, dex: -1, wis: 2 },
  pelerin: { con: 1, wis: 1 },
};

const ABILITY_KEYS: readonly BlockAbility[] = ["str", "dex", "con", "int", "wis", "cha"];

/** Un point de plus ou de moins sur deux caractéristiques au plus : deux roturiers ne sont pas jumeaux. */
const JITTERED_ABILITIES = 2;

function clampAbility(value: number): number {
  return Math.min(30, Math.max(1, value));
}

/** « 2d8+2 » → { count: 2, faces: 8, bonus: 2 } ; `null` si le texte ne se lit pas. */
function parseHitDice(text: string | undefined): { count: number; faces: number; bonus: number } | null {
  const m = /^\s*(\d{1,2})d(\d{1,3})\s*(?:([+-])\s*(\d{1,3}))?\s*$/i.exec(text ?? "");
  if (!m) return null;
  const count = Number(m[1]);
  const faces = Number(m[2]);
  if (count < 1 || faces < 2) return null;
  const bonus = m[4] ? Number(m[4]) * (m[3] === "-" ? -1 : 1) : 0;
  return { count, faces, bonus };
}

export function npcSheetFrom(
  base: StatblockBlockData,
  params: { templateKey: NpcSheetKey; archetype?: string; seed: number }
): StatblockBlockData {
  const rng = new SeededRng(deriveSeed(params.seed, "fiche-pnj"));

  const deltas = (params.archetype !== undefined ? ARCHETYPE_DELTAS[params.archetype] : undefined) ?? {};
  const abilities = { ...base.abilities };
  for (const ability of ABILITY_KEYS) abilities[ability] += deltas[ability] ?? 0;

  const pool = [...ABILITY_KEYS];
  for (let i = 0; i < JITTERED_ABILITIES; i++) {
    const [ability] = pool.splice(rng.nextInt(pool.length), 1);
    abilities[ability] += rng.nextInt(3) - 1;
  }
  for (const ability of ABILITY_KEYS) abilities[ability] = clampAbility(abilities[ability]);

  const dice = parseHitDice(base.hp.hit_dice);
  let hpValue = base.hp.value;
  if (dice) {
    let total = dice.bonus;
    for (let i = 0; i < dice.count; i++) total += 1 + rng.nextInt(dice.faces);
    hpValue = Math.max(1, total);
  }

  return {
    ...base,
    abilities,
    hp: { ...base.hp, value: hpValue },
    based_on: { source: "srd-2024", key: params.templateKey },
  };
}
