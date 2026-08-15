// V1-D6 : convertit scripts/data/monster-statblocks-2024-en.json (sortie de
// extract-monster-statblocks-en.ts, deja verifiee a la main sur un
// echantillon) vers la forme brute attendue par ingest-srd.ts (meme forme
// que les 3 monstres deja authentiquement 2024 dans data/srd/srd-2024.json
// — voir Aboleth), puis les fusionne dans ce fichier par `index`.
//
// N'ecrit JAMAIS directement en base : `ruleset_entries`/`ruleset_entry_blocks`
// d'un ruleset officiel sont verrouilles par un trigger Postgres
// (docs/SCHEMA.md §9.5), seules les migrations d'import SRD sont autorisees
// a le contourner. Le chemin sanctionne est donc : corriger le fichier
// source JSON, puis rejouer `npm run ingest:srd` (deja idempotent, deja
// verifie en V1-A2).
//
// Lancement : npx tsx scripts/apply-monster-statblocks-2024.ts

import { readFileSync, writeFileSync } from "node:fs";

interface ParsedMonster {
  entry_key: string;
  name: string;
  index: string;
  size: string;
  type: string;
  alignment: string;
  armor_class: number;
  hit_points: number;
  hit_dice: string;
  speed: Record<string, string>;
  abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  skills: { name: string; bonus: number }[];
  saving_throws: { ability: string; bonus: number }[];
  senses: Record<string, string>;
  languages: string;
  challenge_rating: number;
  xp: number;
  proficiency_bonus: number;
  traits: { name: string; description: string }[];
  actions: { name: string; description: string; attack_bonus?: number; damage?: { dice: string; type?: string }[] }[];
}

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

/**
 * L'`entry_key` en base est parfois deja desambigue par ingest-srd.ts
 * (suffixe `-monster` quand l'index brut collisionne avec une autre
 * categorie, ex. "druid" classe vs "druid" monstre -> "druid-monster").
 * Ecrire ce suffixe comme `index` brut dans srd-2024.json casse le
 * merge-par-index (`mergeByIndex` compare a l'index NON suffixe de
 * srd-2014.json) : l'entree corrigee s'ajoute alors a cote de la base
 * 2014 au lieu de la remplacer, et ingest-srd.ts desambigue une SECONDE
 * fois en cascade ("druid-monster" -> "druid-monster-monster"), une
 * vraie collision constatee et corrigee ici (V1-D6). Retire le suffixe
 * quand la forme nue existe reellement dans la base 2014.
 */
function rawIndexFor(entryKey: string, baseIndices: Set<string>): string {
  if (entryKey.endsWith("-monster")) {
    const bare = entryKey.slice(0, -"-monster".length);
    if (baseIndices.has(bare)) return bare;
  }
  return entryKey;
}

function toRawMonster(m: ParsedMonster, index: string): Record<string, unknown> {
  const proficiencies: Record<string, unknown>[] = [];
  for (const st of m.saving_throws) {
    proficiencies.push({ value: st.bonus, proficiency: { index: `saving-throw-${st.ability.toLowerCase()}`, name: `Saving Throw: ${st.ability.toUpperCase()}` } });
  }
  for (const sk of m.skills) {
    proficiencies.push({ value: sk.bonus, proficiency: { index: `skill-${slug(sk.name)}`, name: `Skill: ${sk.name}` } });
  }

  return {
    index,
    name: m.name,
    size: m.size,
    type: m.type,
    alignment: m.alignment,
    armor_class: [{ type: "natural", value: m.armor_class }],
    hit_points: m.hit_points,
    hit_dice: m.hit_dice,
    speed: m.speed,
    strength: m.abilities.str,
    dexterity: m.abilities.dex,
    constitution: m.abilities.con,
    intelligence: m.abilities.int,
    wisdom: m.abilities.wis,
    charisma: m.abilities.cha,
    proficiencies,
    senses: m.senses,
    languages: m.languages,
    challenge_rating: m.challenge_rating,
    xp: m.xp,
    proficiency_bonus: m.proficiency_bonus,
    special_abilities: m.traits.map((t) => ({ name: t.name, desc: t.description })),
    actions: m.actions.map((a) => ({
      name: a.name,
      desc: a.description,
      attack_bonus: a.attack_bonus,
      damage: (a.damage ?? []).map((d) => ({ damage_dice: d.dice, damage_type: d.type ? { name: d.type } : undefined })),
    })),
    // Marque explicitement une reconstruction manuelle depuis le PDF
    // officiel anglais (V1-D6), pas une source /2014/ ni une extraction
    // automatique 5e-bits — future execution de ce script ou de
    // extract-monster-statblocks-en.ts doit pouvoir distinguer "deja
    // corrige" de "encore en 2014".
    url: `/api/2024/monsters/${index}`,
  };
}

// Deja authentiquement sourcees 2024 (url /api/2024/... des l'origine,
// avant meme V1-D6 — Aboleth, Dragon noir/bleu adultes) : leur JSON
// d'origine porte une structure plus riche que ce que reconstruit
// extract-monster-statblocks-en.ts (sous-options de Multiattack, objets DC
// avec type/valeur, recharge...). Les reecrire avec la forme simplifiee de
// ce script serait une regression, pas une correction — jamais touchees
// ici, y compris quand --force-all les fait apparaitre dans la sortie du
// parseur pour verification.
const ALREADY_AUTHENTIC_2024 = new Set(["aboleth", "adult-black-dragon", "adult-blue-dragon"]);

function main() {
  const parsed: ParsedMonster[] = JSON.parse(readFileSync("scripts/data/monster-statblocks-2024-en.json", "utf-8"));
  const srd2024 = JSON.parse(readFileSync("data/srd/srd-2024.json", "utf-8"));
  const srd2014 = JSON.parse(readFileSync("data/srd/srd-2014.json", "utf-8"));
  const baseIndices = new Set<string>((srd2014.Monsters ?? []).map((m: Record<string, unknown>) => String(m.index)));

  const existing: Record<string, unknown>[] = srd2024.Monsters ?? [];
  const byIndex = new Map<string, Record<string, unknown>>();
  for (const m of existing) byIndex.set(String(m.index), m);

  let replaced = 0;
  let added = 0;
  let skipped = 0;
  for (const m of parsed) {
    if (ALREADY_AUTHENTIC_2024.has(m.entry_key)) {
      skipped++;
      continue;
    }
    const index = rawIndexFor(m.entry_key, baseIndices);
    const raw = toRawMonster(m, index);
    if (byIndex.has(index)) replaced++;
    else added++;
    byIndex.set(index, raw);
  }

  srd2024.Monsters = [...byIndex.values()];
  writeFileSync("data/srd/srd-2024.json", JSON.stringify(srd2024, null, 2) + "\n", "utf-8");

  console.log(`Monsters dans data/srd/srd-2024.json : ${existing.length} -> ${srd2024.Monsters.length}`);
  console.log(`${replaced} remplaces (etaient en repli 2014), ${added} ajoutes, ${skipped} ecartes (deja authentiquement 2024).`);
  console.log("\nRelancer `npm run ingest:srd` pour appliquer en base.");
}

main();
